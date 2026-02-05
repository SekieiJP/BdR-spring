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
            const elem = document.getElementById(`status-${status}`);
            if (elem) {
                elem.textContent = this.gameState.player[status];
            }
        });
    }

    /**
     * ターン・フェーズ表示更新
     */
    updateTurnDisplay() {
        const turnName = document.getElementById('turn-name');
        const phaseName = document.getElementById('phase-name');

        if (this.gameState.turn < 8) {
            const config = this.turnManager.getCurrentTurnConfig();
            if (turnName) turnName.textContent = config.name;
        }

        const phaseNames = {
            start: '準備中',
            training: '研修',
            action: '教室行動',
            meeting: '教室会議',
            end: '終了'
        };

        if (phaseName) {
            phaseName.textContent = phaseNames[this.gameState.phase] || '-';
        }
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

        // 手札表示
        this.renderHand();

        // スタッフスロットにドロップイベント設定
        this.setupDropZones();
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
     * アクション実行可能チェック
     */
    checkActionReady() {
        const placed = this.gameState.player.placed;
        const allPlaced = Object.values(placed).every(card => card !== null);

        const confirmBtn = document.getElementById('confirm-action');
        if (confirmBtn) {
            confirmBtn.disabled = !allPlaced;
        }
    }

    /**
     * アクション実行
     */
    onConfirmAction() {
        this.turnManager.executeActions();
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
     * デッキ表示
     */
    renderDeck(maxDelete) {
        const deckContainer = document.getElementById('deck-cards');
        if (!deckContainer) return;

        deckContainer.innerHTML = '';

        this.gameState.player.deck.forEach(card => {
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

        // 手札補充
        this.gameState.shuffleDeck();
        this.gameState.drawCards(4);

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
