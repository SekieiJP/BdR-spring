/**
 * CardManager - カード管理と効果処理
 */
export class CardManager {
    constructor(logger) {
        this.logger = logger;
        this.allCards = [];
        this.trainingDecks = {
            N: [],
            R: [],
            SR: [],
            SSR: []
        };
    }

    /**
     * CSVファイルからカードデータをロード
     */
    async loadCards(csvPath) {
        try {
            const response = await fetch(csvPath);
            const csvText = await response.text();

            this.parseCSV(csvText);
            this.logger?.log(`カードデータ読み込み完了: ${this.allCards.length}枚`, 'info');

            return true;
        } catch (error) {
            this.logger?.log(`カードデータ読み込みエラー: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * CSVテキストをパース
     */
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');

        // ヘッダー行をスキップ
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // カンマで分割（簡易版、quoted fieldsは未対応）
            const parts = line.split(',');

            if (parts.length >= 4) {
                const card = {
                    category: parts[0].trim(),
                    rarity: parts[1].trim(),
                    cardName: parts[2].trim(),
                    effect: parts[3].trim()
                };

                this.allCards.push(card);

                // レアリティ別デッキに追加
                if (this.trainingDecks[card.rarity]) {
                    this.trainingDecks[card.rarity].push(card);
                }
            }
        }
    }

    /**
     * 基本カード（N）を取得
     */
    getBasicCards() {
        const basicCards = [];
        const nCards = this.trainingDecks.N;

        // 各基本カードを2枚ずつ
        nCards.forEach(card => {
            basicCards.push({ ...card });
            basicCards.push({ ...card });
        });

        return basicCards;
    }

    /**
     * 指定レアリティのカードをシャッフル
     */
    shuffleTrainingDeck(rarity) {
        const deck = this.trainingDecks[rarity];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    /**
     * 研修カードを引く
     */
    drawTrainingCards(rarity, count) {
        if (!this.trainingDecks[rarity]) {
            this.logger?.log(`不明なレアリティ: ${rarity}`, 'error');
            return [];
        }

        const deck = this.trainingDecks[rarity];
        const drawn = [];

        for (let i = 0; i < count; i++) {
            if (deck.length === 0) {
                // デッキが空の場合は何も引けない
                this.logger?.log(`研修会場の${rarity}デッキが空です`, 'info');
                break;
            }
            drawn.push({ ...deck.pop() });
        }

        return drawn;
    }

    /**
     * カード効果をパース
     * @param {string} effectText - 効果テキスト
     * @param {string} staff - 実行スタッフ (leader, teacher, staff)
     * @returns {Object} パース済み効果
     */
    parseEffect(effectText, staff) {
        const result = {
            base: [],
            conditional: [],
            restrictions: []
        };

        // 【】で対象スタッフを抽出
        const restrictMatch = effectText.match(/【([^】]+)】/);
        if (restrictMatch) {
            const allowed = restrictMatch[1];
            const staffMap = {
                '室長': 'leader',
                '講師': 'teacher',
                '事務': 'staff',
                '専任講師': 'teacher'
            };

            result.restrictions = allowed.split('・').map(s => staffMap[s.trim()]).filter(Boolean);
        }

        // 基本効果を抽出（体験+2、入塾+3など）
        const baseMatches = effectText.matchAll(/([体験入塾満足経理])\+(\d+)/g);
        for (const match of baseMatches) {
            const statusMap = {
                '体験': 'experience',
                '入塾': 'enrollment',
                '満足': 'satisfaction',
                '経理': 'accounting'
            };

            // 〈〉の中にある効果は条件付きなのでスキップ
            const isConditional = effectText.indexOf('〈') > -1 &&
                effectText.indexOf(match[0]) > effectText.indexOf('〈');

            if (!isConditional) {
                result.base.push({
                    type: statusMap[match[1]],
                    value: parseInt(match[2])
                });
            }
        }

        // 条件付き効果を抽出（〈室長〉さらに体験+2など）
        const condMatches = effectText.matchAll(/〈([^〉]+)〉([^。〈]*)/g);
        for (const match of condMatches) {
            const condition = match[1].trim();
            const condEffect = match[2].trim();

            // スタッフ条件
            const staffCondMap = {
                '室長': 'leader',
                '講師': 'teacher',
                '事務': 'staff'
            };

            if (staffCondMap[condition]) {
                // スタッフ条件の場合
                if (staff === staffCondMap[condition]) {
                    const effectMatches = condEffect.matchAll(/([体験入塾満足経理])\+(\d+)/g);
                    for (const em of effectMatches) {
                        const statusMap = {
                            '体験': 'experience',
                            '入塾': 'enrollment',
                            '満足': 'satisfaction',
                            '経理': 'accounting'
                        };

                        result.conditional.push({
                            type: statusMap[em[1]],
                            value: parseInt(em[2]),
                            condition: `staff:${staff}`
                        });
                    }
                }
            } else if (condition.includes('以上') || condition.includes('以下')) {
                // ステータス条件（例: 満足8以上）
                result.conditional.push({
                    rawCondition: condition,
                    rawEffect: condEffect,
                    needsGameState: true
                });
            }
        }

        // マイナス効果を抽出
        const negMatches = effectText.matchAll(/([体験入塾満足経理])-(\d+)/g);
        for (const match of negMatches) {
            const statusMap = {
                '体験': 'experience',
                '入塾': 'enrollment',
                '満足': 'satisfaction',
                '経理': 'accounting'
            };

            result.base.push({
                type: statusMap[match[1]],
                value: -parseInt(match[2])
            });
        }

        return result;
    }

    /**
     * カード効果を適用
     */
    applyCardEffect(card, staff, gameState) {
        const parsed = this.parseEffect(card.effect, staff);

        // スタッフ制限チェック
        if (parsed.restrictions.length > 0 && !parsed.restrictions.includes(staff)) {
            this.logger?.log(`${card.cardName}は指定されたスタッフに配置できません（NG）`, 'error');
            return false;
        }

        this.logger?.log(`カード効果発動: ${card.cardName} (${card.category})`, 'action');

        // 基本効果を適用
        parsed.base.forEach(effect => {
            gameState.updateStatus(effect.type, effect.value);
        });

        // 条件付き効果を適用
        parsed.conditional.forEach(effect => {
            if (effect.needsGameState) {
                // ステータス条件の効果（未実装の場合は警告）
                this.logger?.log(`条件付き効果（未実装）: ${effect.rawCondition}`, 'info');
            } else {
                // スタッフ条件の効果
                gameState.updateStatus(effect.type, effect.value);
            }
        });

        return true;
    }
}
