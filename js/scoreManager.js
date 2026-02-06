/**
 * ScoreManager - スコア計算・記録・共有
 */
export class ScoreManager {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * 退塾数を計算
     */
    calculateWithdrawal(gameState) {
        const accounting = gameState.player.accounting;
        const satisfaction = gameState.player.satisfaction;

        const accountingShortage = Math.max(15 - accounting, 0);
        const satisfactionShortage = Math.max(15 - satisfaction, 0);

        return accountingShortage + satisfactionShortage;
    }

    /**
     * スコアを計算
     */
    calculateScore(gameState) {
        const withdrawal = this.calculateWithdrawal(gameState);
        const mobilization = gameState.player.experience; // 動員目標は体験数のみ
        const enrollmentDiff = gameState.player.enrollment - withdrawal;

        let points = 0;

        // 退塾目標
        if (withdrawal >= 4) {
            points -= 3;
        } else if (withdrawal <= 1) {
            points += 1;
        }

        // 動員目標
        if (mobilization >= 12) {
            points += 2;
        } else if (mobilization >= 10) {
            points += 1;
        }

        // 入退目標
        if (enrollmentDiff >= 12) {
            points += 5;
        } else if (enrollmentDiff >= 10) {
            points += 4;
        } else if (enrollmentDiff >= 8) {
            points += 3;
        }

        this.logger?.log('--- スコア計算 ---', 'info');
        this.logger?.log(`退塾数: ${withdrawal}`, 'status');
        this.logger?.log(`動員合計: ${mobilization}`, 'status');
        this.logger?.log(`入退差: ${enrollmentDiff}`, 'status');
        this.logger?.log(`目標ポイント: ${points}`, 'status');

        return {
            points,
            withdrawal,
            mobilization,
            enrollmentDiff,
            experience: gameState.player.experience,
            enrollment: gameState.player.enrollment,
            satisfaction: gameState.player.satisfaction,
            accounting: gameState.player.accounting
        };
    }

    /**
     * ハイスコアを取得
     */
    getHighScore() {
        try {
            const saved = localStorage.getItem('bdrinkai_highscore');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            this.logger?.log(`ハイスコア読み込みエラー: ${error.message}`, 'error');
        }
        return null;
    }

    /**
     * ハイスコアを保存
     */
    saveHighScore(score) {
        try {
            const current = this.getHighScore();

            // 現在のスコアがハイスコアより高い場合のみ保存
            if (!current || score.points > current.points) {
                localStorage.setItem('bdrinkai_highscore', JSON.stringify({
                    points: score.points,
                    date: new Date().toISOString(),
                    ...score
                }));

                this.logger?.log(`新ハイスコア記録: ${score.points}ポイント`, 'action');
                return true;
            }
        } catch (error) {
            this.logger?.log(`ハイスコア保存エラー: ${error.message}`, 'error');
        }
        return false;
    }

    /**
     * スコア共有URLを生成
     */
    generateShareURL(score) {
        const params = new URLSearchParams({
            p: score.points,
            w: score.withdrawal,
            m: score.mobilization,
            d: score.enrollmentDiff,
            exp: score.experience,
            enr: score.enrollment,
            sat: score.satisfaction,
            acc: score.accounting
        });

        const baseURL = window.location.origin + window.location.pathname;
        return `${baseURL}?score=${params.toString()}`;
    }

    /**
     * URLからスコアを読み込み
     */
    loadScoreFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const scoreParam = urlParams.get('score');

        if (scoreParam) {
            try {
                const scoreParams = new URLSearchParams(scoreParam);
                return {
                    points: parseInt(scoreParams.get('p')) || 0,
                    withdrawal: parseInt(scoreParams.get('w')) || 0,
                    mobilization: parseInt(scoreParams.get('m')) || 0,
                    enrollmentDiff: parseInt(scoreParams.get('d')) || 0,
                    experience: parseInt(scoreParams.get('exp')) || 0,
                    enrollment: parseInt(scoreParams.get('enr')) || 0,
                    satisfaction: parseInt(scoreParams.get('sat')) || 0,
                    accounting: parseInt(scoreParams.get('acc')) || 0
                };
            } catch (error) {
                this.logger?.log(`URL からのスコア読み込みエラー: ${error.message}`, 'error');
            }
        }

        return null;
    }
}
