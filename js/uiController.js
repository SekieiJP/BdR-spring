/**
 * UIController - UI操作・表示制御
 */
export class UIController {
    constructor(gameState, cardManager, turnManager, scoreManager, logger) {
        this.gameState = gameState;
        this.cardManager = cardManager;
        this.turnManager = turnManager;
        this.scoreManager = scoreManager;
        this.logger = logger;

        this.selectedTrainingCard = null;
        this.selectedCardsForDeletion = [];
        this.tapMode = true; // タップ順配置モード
    }

    /**
     * UI初期化
     */
    init() {
        this.updateStatusDisplay();
        this.updateTurnDisplay();

        // イベントリスナー設定
        this.setupEventListeners();

        // スクロール検知設定
        this.setupScrollListener();
    }

    /**
     * スクロール検知設定
     */
    setupScrollListener() {
        const stickyHeader = document.getElementById('sticky-header');
        const fullStatusPanel = document.getElementById('full-status-panel');

        if (!stickyHeader || !fullStatusPanel) return;

        window.addEventListener('scroll', () => {
            const panelRect = fullStatusPanel.getBoundingClientRect();
            // ステータスパネルが完全に画面外に出たらコンパクトヘッダーを表示
            if (panelRect.bottom < 0) {
                stickyHeader.classList.remove('hidden');
            } else {
                stickyHeader.classList.add('hidden');
            }
        });
    }

    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // スタートボタン
        const startBtn = document.getElementById('start-game');
        startBtn?.addEventListener('click', () => this.onStartGame());

        // 研修確定ボタン
        const confirmTrainingBtn = document.getElementById('confirm-training');
        confirmTrainingBtn?.addEventListener('click', () => this.onConfirmTraining());

        // アクション実行ボタン
        const confirmActionBtn = document.getElementById('confirm-action');
        confirmActionBtn?.addEventListener('click', () => this.onConfirmAction());

        // 会議確定ボタン
        const confirmMeetingBtn = document.getElementById('confirm-meeting');
        confirmMeetingBtn?.addEventListener('click', () => this.onConfirmMeeting());

        // リスタートボタン
        const restartBtn = document.getElementById('restart-game');
        restartBtn?.addEventListener('click', () => this.onRestart());

        // スコア共有ボタン
        const shareBtn = document.getElementById('share-score');
        shareBtn?.addEventListener('click', () => this.onShareScore());
    }

    /**
     * ステータス表示更新
     */
    updateStatusDisplay() {
        const statuses = ['experience', 'enrollment', 'satisfaction', 'accounting'];
        statuses.forEach(status => {
            // フル表示
            const elem = document.getElementById(`status-${status}`);
            if (elem) {
                elem.textContent = this.gameState.player[status];
            }
            // コンパクト表示
            const compactElem = document.getElementById(`compact-${status}`);
            if (compactElem) {
                compactElem.textContent = this.gameState.player[status];
            }
        });
    }

    /**
     * ターン・フェーズ表示更新
     */
    updateTurnDisplay() {
        const turnName = document.getElementById('turn-name');
        const phaseName = document.getElementById('phase-name');
        const compactTurn = document.getElementById('compact-turn');
        const compactPhase = document.getElementById('compact-phase');
        const compactRecommended = document.getElementById('compact-recommended');

        let turnText = '準備中';
        let recommendedText = '-';

        if (this.gameState.turn < 8) {
            const config = this.turnManager.getCurrentTurnConfig();
            turnText = config.name;
            recommendedText = config.recommended || '-';
        }

        if (turnName) turnName.textContent = turnText;
        if (compactTurn) compactTurn.textContent = turnText;

        const phaseNames = {
            start: '準備中',
            training: '研修',
            action: '教室行動',
            meeting: '教室会議',
            end: '終了'
        };

        const phaseText = phaseNames[this.gameState.phase] || '-';
        if (phaseName) phaseName.textContent = phaseText;
        if (compactPhase) compactPhase.textContent = phaseText;
        if (compactRecommended) compactRecommended.textContent = recommendedText;
    }

    /**
     * フェーズエリアの表示切り替え
     */
    showPhaseArea(phase) {
        const areas = ['training-area', 'action-area', 'meeting-area', 'result-area'];
        areas.forEach(areaId => {
            const elem = document.getElementById(areaId);
            if (elem) {
                elem.classList.toggle('hidden', areaId !== `${phase}-area`);
            }
        });
    }

    /**
     * カードHTML生成
     */
    createCardElement(card, options = {}) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        if (options.draggable) {
            cardDiv.draggable = true;
            cardDiv.addEventListener('dragstart', (e) => this.onCardDragStart(e, card));
            cardDiv.addEventListener('dragend', (e) => this.onCardDragEnd(e));
        }

        if (options.clickable) {
            cardDiv.addEventListener('click', () => options.onClick(card, cardDiv));
        }

        cardDiv.innerHTML = `
            <div class="card-header">
                <span class="card-name">${card.cardName}</span>
                <span class="card-rarity rarity-${card.rarity}">${card.rarity}</span>
            </div>
            <div class="card-category category-${card.category}">${card.category}</div>
            <div class="card-effect">${card.effect}</div>
        `;

        return cardDiv;
    }

    /**
     * ゲーム開始
     */
    onStartGame() {
        const overlay = document.getElementById('start-overlay');
        overlay?.classList.add('hidden');

        this.turnManager.initializeGame();

        // 初回研修（Rカード4枚から2枚選択）
        this.showInitialTraining();
    }

    /**
     * 初回研修表示
     */
    showInitialTraining() {
        const trainingCards = this.cardManager.drawTrainingCards('R', 4);
        const container = document.getElementById('training-cards');
        if (!container) return;

        container.innerHTML = '';
        this.selectedInitialCards = [];

        trainingCards.forEach(card => {
            const cardElem = this.createCardElement(card, {
                clickable: true,
                onClick: (c, elem) => this.onInitialCardSelect(c, elem, trainingCards)
            });
            container.appendChild(cardElem);
        });

        this.showPhaseArea('training');
        this.updateTurnDisplay();

        const instruction = document.querySelector('#training-area .instruction');
        if (instruction) {
            instruction.textContent = '初回研修: 4枚から2枚を選んで習得してください';
        }
    }

    /**
     * 初回カード選択
     */
    onInitialCardSelect(card, elem, allCards) {
        const index = this.selectedInitialCards.indexOf(card);

        if (index > -1) {
            // 選択解除
            this.selectedInitialCards.splice(index, 1);
            elem.classList.remove('selected');
        } else {
            // 選択
            if (this.selectedInitialCards.length < 2) {
                this.selectedInitialCards.push(card);
                elem.classList.add('selected');
            }
        }

        // 確定ボタン有効化
        const confirmBtn = document.getElementById('confirm-training');
        if (confirmBtn) {
            confirmBtn.disabled = this.selectedInitialCards.length !== 2;
        }
    }

    /**
     * 研修確定
     */
    onConfirmTraining() {
        if (this.gameState.turn === 0 && this.selectedInitialCards) {
            // 初回研修
            this.selectedInitialCards.forEach(card => {
                this.gameState.addToDeck(card);
            });
        } else {
            // 通常研修
            if (this.selectedTrainingCard) {
                this.gameState.addToDeck(this.selectedTrainingCard);
                this.selectedTrainingCard = null;
            }
        }

        // フェーズをtrainingに設定してからadvancePhaseを呼ぶ
        // これによりadvancePhaseがtraining→actionへ正しく遷移する
        this.gameState.phase = 'training';
        this.turnManager.advancePhase();
        this.showActionPhase();
    }

    /**
     * 教室行動フェーズ表示
     */
    showActionPhase() {
        this.showPhaseArea('action');
        this.updateTurnDisplay();
        this.updateStatusDisplay();

        // スタッフスロットをクリア（前ターンのカード表示を削除）
        this.clearStaffSlots();

        // 配置済み状態もクリア
        this.gameState.clearPlaced();

        // 手札表示
        this.renderHand();

        // スタッフスロットにドロップイベント設定
        this.setupDropZones();

        // ボタン状態を更新
        this.updateActionButtonState();
    }

    /**
     * スタッフスロットのUIをクリア
     */
    clearStaffSlots() {
        const staffIds = ['slot-leader', 'slot-teacher', 'slot-staff'];
        staffIds.forEach(id => {
            const slot = document.getElementById(id);
            if (slot) {
                slot.innerHTML = '<span class="slot-placeholder">タップまたはドラッグ</span>';
                slot.classList.remove('filled');
            }
        });
    }

    /**
     * 手札表示
     */
    renderHand() {
        const handContainer = document.getElementById('hand-cards');
        if (!handContainer) return;

        handContainer.innerHTML = '';

        this.gameState.player.hand.forEach(card => {
            const cardElem = this.createCardElement(card, {
                draggable: true,
                clickable: true,
                onClick: (c) => this.onHandCardTap(c)
            });
            handContainer.appendChild(cardElem);
        });
    }

    /**
     * 手札カードタップ（タップ順配置）
     */
    onHandCardTap(card) {
        const staffOrder = ['leader', 'teacher', 'staff'];

        // 空いている最初のスロットに配置
        for (const staff of staffOrder) {
            if (!this.gameState.player.placed[staff]) {
                this.placeCardToSlot(card, staff);
                break;
            }
        }
    }

    /**
     * カードをスロットに配置
     */
    placeCardToSlot(card, staff) {
        this.gameState.placeCard(card, staff);
        this.gameState.removeFromHand(card);

        // UI更新
        const slot = document.getElementById(`slot-${staff}`);
        if (slot) {
            slot.innerHTML = '';
            const cardElem = this.createCardElement(card, {
                clickable: true,
                onClick: () => this.onPlacedCardClick(card, staff)
            });
            slot.appendChild(cardElem);
            slot.classList.add('filled');
        }

        this.renderHand();
        this.checkActionReady();
    }

    /**
     * 配置済みカードクリック（取り消し）
     */
    onPlacedCardClick(card, staff) {
        this.gameState.player.placed[staff] = null;
        this.gameState.addToHand(card);

        const slot = document.getElementById(`slot-${staff}`);
        if (slot) {
            slot.innerHTML = '<span class="slot-placeholder">タップまたはドラッグ</span>';
            slot.classList.remove('filled');
        }

        this.renderHand();
        this.checkActionReady();
    }

    /**
     * ドロップゾーン設定
     */
    setupDropZones() {
        const slots = ['leader', 'teacher', 'staff'];

        slots.forEach(staff => {
            const slot = document.getElementById(`slot-${staff}`);
            if (!slot) return;

            slot.addEventListener('dragover', (e) => {
                e.preventDefault();
                slot.classList.add('drag-over');
            });

            slot.addEventListener('dragleave', () => {
                slot.classList.remove('drag-over');
            });

            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.classList.remove('drag-over');

                if (this.draggedCard && !this.gameState.player.placed[staff]) {
                    this.placeCardToSlot(this.draggedCard, staff);
                }
            });
        });
    }

    /**
     * カードドラッグ開始
     */
    onCardDragStart(e, card) {
        this.draggedCard = card;
        e.currentTarget.classList.add('dragging');
    }

    /**
     * カードドラッグ終了
     */
    onCardDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        this.draggedCard = null;
    }

    /**
     * アクションボタン状態更新（常に有効）
     */
    updateActionButtonState() {
        const confirmBtn = document.getElementById('confirm-action');
        if (confirmBtn) {
            // ボタンは常に有効（未配置時は警告表示）
            confirmBtn.disabled = false;
        }
    }

    /**
     * 全スタッフ配置済みチェック
     */
    isAllStaffPlaced() {
        const placed = this.gameState.player.placed;
        return Object.values(placed).every(card => card !== null);
    }

    /**
     * アクション実行
     */
    onConfirmAction() {
        // 未配置スタッフがいる場合は警告
        if (!this.isAllStaffPlaced()) {
            const confirmed = confirm('カードが配置されていないスタッフがいます。教室行動を確定させてよろしいですか？');
            if (!confirmed) {
                return;
            }
        }

        // 実行前のステータスを記録
        const beforeStats = {
            experience: this.gameState.player.experience,
            enrollment: this.gameState.player.enrollment,
            satisfaction: this.gameState.player.satisfaction,
            accounting: this.gameState.player.accounting
        };

        // アクション実行
        const actionInfo = this.turnManager.executeActions();

        // 実行後のステータス
        const afterStats = {
            experience: this.gameState.player.experience,
            enrollment: this.gameState.player.enrollment,
            satisfaction: this.gameState.player.satisfaction,
            accounting: this.gameState.player.accounting
        };

        // ステータス変動演出を表示
        this.showStatusAnimation(beforeStats, afterStats, actionInfo);
    }

    /**
     * ステータス変動演出を表示
     */
    showStatusAnimation(beforeStats, afterStats, actionInfo) {
        const overlay = document.getElementById('status-animation-overlay');
        const header = document.getElementById('animation-header');
        const cards = document.getElementById('animation-cards');

        if (!overlay) {
            // 演出要素がなければスキップして次へ進む
            this.finishActionPhase();
            return;
        }

        // 初期値を設定
        document.getElementById('anim-exp-value').textContent = beforeStats.experience;
        document.getElementById('anim-enr-value').textContent = beforeStats.enrollment;
        document.getElementById('anim-sat-value').textContent = beforeStats.satisfaction;
        document.getElementById('anim-acc-value').textContent = beforeStats.accounting;

        // デルタをクリア
        ['exp', 'enr', 'sat', 'acc'].forEach(id => {
            const deltaElem = document.getElementById(`anim-${id}-delta`);
            if (deltaElem) {
                deltaElem.textContent = '';
                deltaElem.className = 'anim-delta';
            }
        });

        // オーバーレイ表示
        overlay.classList.remove('hidden');
        header.innerHTML = '';
        cards.innerHTML = '';

        // 演出シーケンス
        const config = this.turnManager.getCurrentTurnConfig();
        const placed = this.gameState.player.placed;

        let delay = 500;

        // おすすめ行動ボーナス表示
        if (config.recommended) {
            setTimeout(() => {
                header.innerHTML = `🎯 おすすめ行動: ${config.recommended}`;
            }, delay);
            delay += 2000;
        }

        // 各カード効果表示
        ['leader', 'teacher', 'staff'].forEach((staff, i) => {
            const card = placed[staff];
            if (card) {
                setTimeout(() => {
                    const staffNames = { leader: '室長', teacher: '講師', staff: '事務' };
                    cards.innerHTML = `<div class="animation-card-item">${staffNames[staff]}: ${card.cardName}<br><small>${card.effect}</small></div>`;
                }, delay + i * 1500);
            }
        });
        delay += Object.values(placed).filter(c => c).length * 1500;

        // ステータス更新アニメーション
        setTimeout(() => {
            cards.innerHTML = '';
            header.innerHTML = '📊 ステータス変動';
            this.animateStatusUpdate(beforeStats, afterStats);
        }, delay);

        // 演出終了
        setTimeout(() => {
            overlay.classList.add('hidden');
            this.finishActionPhase();
        }, delay + 2000);
    }

    /**
     * ステータス更新アニメーション
     */
    animateStatusUpdate(before, after) {
        const statMap = {
            experience: 'exp',
            enrollment: 'enr',
            satisfaction: 'sat',
            accounting: 'acc'
        };

        Object.entries(statMap).forEach(([key, id]) => {
            const valueElem = document.getElementById(`anim-${id}-value`);
            const deltaElem = document.getElementById(`anim-${id}-delta`);
            const delta = after[key] - before[key];

            if (valueElem) {
                valueElem.textContent = after[key];
                valueElem.classList.add('updating');
                setTimeout(() => valueElem.classList.remove('updating'), 300);
            }

            if (deltaElem && delta !== 0) {
                deltaElem.textContent = delta > 0 ? `+${delta}` : `${delta}`;
                deltaElem.classList.add(delta > 0 ? 'positive' : 'negative');
            }
        });
    }

    /**
     * アクションフェーズ終了処理
     */
    finishActionPhase() {
        this.updateStatusDisplay();
        this.turnManager.advancePhase();
        this.showMeetingPhase();
    }

    /**
     * 教室会議フェーズ表示
     */
    showMeetingPhase() {
        this.showPhaseArea('meeting');
        this.updateTurnDisplay();

        const config = this.turnManager.getCurrentTurnConfig();
        const deleteCountElem = document.getElementById('delete-count');
        const maxDeleteElem = document.getElementById('max-delete');

        if (deleteCountElem) deleteCountElem.textContent = config.delete;
        if (maxDeleteElem) maxDeleteElem.textContent = config.delete;

        this.selectedCardsForDeletion = [];
        this.renderDeck(config.delete);
    }

    /**
     * デッキ表示（獲得ターン順にソート）
     */
    renderDeck(maxDelete) {
        const deckContainer = document.getElementById('deck-cards');
        if (!deckContainer) return;

        deckContainer.innerHTML = '';

        // 獲得ターン順（古い順）にソート
        const sortedDeck = [...this.gameState.player.deck].sort((a, b) => {
            const turnA = a.acquiredTurn ?? 0;
            const turnB = b.acquiredTurn ?? 0;
            return turnA - turnB;
        });

        sortedDeck.forEach(card => {
            const cardElem = this.createCardElement(card, {
                clickable: maxDelete > 0,
                onClick: (c, elem) => this.onDeckCardSelect(c, elem, maxDelete)
            });
            deckContainer.appendChild(cardElem);
        });
    }

    /**
     * デッキカード選択（削除用）
     */
    onDeckCardSelect(card, elem, maxDelete) {
        const index = this.selectedCardsForDeletion.indexOf(card);

        if (index > -1) {
            this.selectedCardsForDeletion.splice(index, 1);
            elem.classList.remove('selected');
        } else {
            if (this.selectedCardsForDeletion.length < maxDelete) {
                this.selectedCardsForDeletion.push(card);
                elem.classList.add('selected');
            }
        }

        const selectedCountElem = document.getElementById('selected-count');
        if (selectedCountElem) {
            selectedCountElem.textContent = this.selectedCardsForDeletion.length;
        }
    }

    /**
     * 会議確定
     */
    onConfirmMeeting() {
        // カード削除
        this.selectedCardsForDeletion.forEach(card => {
            this.gameState.removeFromDeck(card);
        });

        this.selectedCardsForDeletion = [];

        // 手札補充は削除（アクションフェーズ開始時に引くため）
        // 代わりに、残りの手札をデッキに戻す
        this.gameState.player.hand.forEach(card => {
            this.gameState.player.deck.push(card);
        });
        this.gameState.player.hand = [];

        // 次のターンへ
        this.turnManager.advancePhase();

        if (this.gameState.phase === 'end') {
            this.showResultPhase();
        } else {
            this.showTrainingPhase();
        }
    }

    /**
     * 研修フェーズ表示（2ターン目以降）
     */
    showTrainingPhase() {
        const config = this.turnManager.getCurrentTurnConfig();
        const trainingCards = this.cardManager.drawTrainingCards(config.training, 3);

        const container = document.getElementById('training-cards');
        if (!container) return;

        container.innerHTML = '';
        this.selectedTrainingCard = null;

        trainingCards.forEach(card => {
            const cardElem = this.createCardElement(card, {
                clickable: true,
                onClick: (c, elem) => this.onTrainingCardSelect(c, elem, container)
            });
            container.appendChild(cardElem);
        });

        this.showPhaseArea('training');
        this.updateTurnDisplay();

        const instruction = document.querySelector('#training-area .instruction');
        if (instruction) {
            instruction.textContent = '3枚から1枚を選んで習得してください';
        }
    }

    /**
     * 研修カード選択
     */
    onTrainingCardSelect(card, elem, container) {
        // 前の選択をクリア
        container.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));

        this.selectedTrainingCard = card;
        elem.classList.add('selected');

        const confirmBtn = document.getElementById('confirm-training');
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
    }

    /**
     * 結果フェーズ表示
     */
    showResultPhase() {
        const score = this.scoreManager.calculateScore(this.gameState);

        this.showPhaseArea('result');

        // スコア表示
        document.getElementById('result-points').textContent = score.points;
        document.getElementById('result-withdrawal').textContent = score.withdrawal;
        document.getElementById('result-mobilization').textContent = score.mobilization;
        document.getElementById('result-diff').textContent = score.enrollmentDiff;

        // ハイスコア保存・表示
        this.scoreManager.saveHighScore(score);
        const highScore = this.scoreManager.getHighScore();
        const highScoreElem = document.getElementById('high-score');
        if (highScoreElem && highScore) {
            highScoreElem.textContent = `${highScore.points}ポイント`;
        }
    }

    /**
     * スコア共有
     */
    onShareScore() {
        const score = this.scoreManager.calculateScore(this.gameState);
        const url = this.scoreManager.generateShareURL(score);

        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                alert('スコア共有URLをクリップボードにコピーしました！');
            }).catch(() => {
                this.showShareURL(url);
            });
        } else {
            this.showShareURL(url);
        }
    }

    /**
     * 共有URL表示
     */
    showShareURL(url) {
        const message = `スコア共有URL:\n${url}`;
        alert(message);
    }

    /**
     * リスタート
     */
    onRestart() {
        this.logger.clear();
        this.onStartGame();
    }
}
