/**
 * Main - エントリーポイント
 * v20260205-2355: 効果テキストパーサー完全実装
 */
import { Logger } from './logger.js?v=20260205-2355';
import { GameState } from './gameState.js?v=20260205-2355';
import { CardManager } from './cardManager.js?v=20260205-2355';
import { TurnManager } from './turnManager.js?v=20260205-2355';
import { ScoreManager } from './scoreManager.js?v=20260205-2355';
import { UIController } from './uiController.js?v=20260205-2355';

class Game {
    constructor() {
        this.logger = new Logger();
        this.gameState = new GameState(this.logger);
        this.cardManager = new CardManager(this.logger);
        this.turnManager = new TurnManager(this.gameState, this.cardManager, this.logger);
        this.scoreManager = new ScoreManager(this.logger);
        this.uiController = new UIController(
            this.gameState,
            this.cardManager,
            this.turnManager,
            this.scoreManager,
            this.logger
        );
    }

    async initialize() {
        this.logger.log('ボードでRinkai 起動中...', 'info');

        // ログUI初期化
        this.logger.init();

        // カードデータロード
        const success = await this.cardManager.loadCards('data/cards.csv');
        if (!success) {
            this.logger.log('カードデータの読み込みに失敗しました', 'error');
            alert('ゲームの初期化に失敗しました。ページを再読み込みしてください。');
            return;
        }

        // UI初期化
        this.uiController.init();

        // URLからスコアを読み込み（共有リンクの場合）
        const sharedScore = this.scoreManager.loadScoreFromURL();
        if (sharedScore) {
            this.showSharedScore(sharedScore);
        }

        this.logger.log('初期化完了: ゲーム開始ボタンを押してください', 'info');
    }

    showSharedScore(score) {
        const message = `
共有されたスコア:
目標ポイント: ${score.points}
退塾数: ${score.withdrawal}
動員合計: ${score.mobilization}
入退差: ${score.enrollmentDiff}

詳細:
体験: ${score.experience}
入塾: ${score.enrollment}
満足: ${score.satisfaction}
経理: ${score.accounting}
        `.trim();

        alert(message);
        this.logger.log('共有スコアを表示しました', 'info');
    }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', async () => {
    const game = new Game();

    // デバッグ用: ゲームインスタンスをwindowに公開
    window.game = game;
    console.log('[DEBUG] ゲームインスタンスがwindow.gameに公開されました');

    await game.initialize();
});
