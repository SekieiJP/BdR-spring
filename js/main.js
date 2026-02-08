/**
 * Main - エントリーポイント
 * v20260206-1930: TASK-3/4/5/6実装
 */
import { Logger } from './logger.js?v=20260206-1930';
import { GameState } from './gameState.js?v=20260206-1930';
import { CardManager } from './cardManager.js?v=20260206-1930';
import { TurnManager } from './turnManager.js?v=20260206-1930';
import { ScoreManager } from './scoreManager.js?v=20260206-1930';
import { UIController } from './uiController.js?v=20260206-1930';

const CACHE_BUSTER = 'v20260206-1930';

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
        const success = await this.cardManager.loadCards('data/cardsV2.csv');
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

    // デバッグモード: URLパラメータまたはコンソールから設定可能
    window.debugCards = {
        training: [], // 研修会場に出したいカード名のリスト
        hand: []      // 手札に出したいカード名のリスト
    };

    // デバッグ関数: 研修候補に特定のカードを出す
    window.setDebugTrainingCards = function (cardNames) {
        window.debugCards.training = Array.isArray(cardNames) ? cardNames : [cardNames];
        console.log('[DEBUG] 研修候補設定:', window.debugCards.training);
    };

    // デバッグ関数: 手札に特定のカードを出す
    window.setDebugHandCards = function (cardNames) {
        window.debugCards.hand = Array.isArray(cardNames) ? cardNames : [cardNames];
        console.log('[DEBUG] 手札候補設定:', window.debugCards.hand);
    };

    // デバッグ関数: カード名で検索
    window.findCard = function (searchTerm) {
        const matches = game.cardManager.allCards.filter(c =>
            c.cardName.includes(searchTerm) || c.effect.includes(searchTerm)
        );
        console.table(matches.map(c => ({ name: c.cardName, category: c.category, rarity: c.rarity, effect: c.effect })));
        return matches;
    };

    // URLからデバッグ設定を読み込み
    const params = new URLSearchParams(window.location.search);
    if (params.has('debug_training')) {
        window.debugCards.training = params.get('debug_training').split(',');
        console.log('[DEBUG] URL: 研修候補設定:', window.debugCards.training);
    }
    if (params.has('debug_hand')) {
        window.debugCards.hand = params.get('debug_hand').split(',');
        console.log('[DEBUG] URL: 手札候補設定:', window.debugCards.hand);
    }

    await game.initialize();
});
