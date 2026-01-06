document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const treasureBox = document.getElementById('treasureBox');
    const spinBtn = document.getElementById('spinBtn');
    const serialInput = document.getElementById('serialCode');
    const flashOverlay = document.getElementById('flashOverlay');
    const resultModal = document.getElementById('resultModal');
    const resultContent = document.getElementById('resultContent');
    const closeBtn = document.getElementById('closeBtn');
    const historyContainer = document.getElementById('historyContainer');
    const gachaContainer = document.querySelector('.gacha-container');

    // State
    const ASSETS = {
        boxClosed: 'assets/box_closed.png',
        boxOpen: 'assets/box_open.png',
        winEffect: 'assets/win_effect.png'
    };

    const AUDIO_ASSETS = {
        boxMove: 'assets/boxmove.mp3',
        boxOpen: 'assets/boxopen.mp3',
        prise: 'assets/prise.mp3',
        coin: 'assets/coin.mp3',
        lose: 'assets/lose.mp3'
    };

    const audio = {
        boxMove: new Audio(AUDIO_ASSETS.boxMove),
        boxOpen: new Audio(AUDIO_ASSETS.boxOpen),
        prise: new Audio(AUDIO_ASSETS.prise),
        coin: new Audio(AUDIO_ASSETS.coin),
        lose: new Audio(AUDIO_ASSETS.lose)
    };
    // audio.boxMove.loop = true; // Loop removed as per user request

    // Helper to play result sound
    function playResultSound(rank) {
        if (!rank) return;
        // Stop any previous result sounds
        audio.prise.pause(); audio.prise.currentTime = 0;
        audio.coin.pause(); audio.coin.currentTime = 0;
        audio.lose.pause(); audio.lose.currentTime = 0;

        if (rank === 'SSR' || rank === 'SR') {
            audio.prise.play().catch(e => console.warn('Sound play error', e));
        } else if (rank === 'R' || rank === 'POINT') {
            audio.coin.play().catch(e => console.warn('Sound play error', e));
        } else if (rank === 'LOSE') {
            audio.lose.play().catch(e => console.warn('Sound play error', e));
        }
    }

    // 設定値は config.js に分離されました
    // config.js が script.js より先に読み込まれている必要があります

    let currentUserId = 'anonymous';
    let currentUserName = 'Guest';

    // LIFFの初期化
    async function initializeLiff() {
        try {
            await liff.init({ liffId: MY_LIFF_ID });
            if (liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                currentUserId = profile.userId;
                currentUserName = profile.displayName;
                console.log('LIFF Initialized. User:', currentUserName, '(', currentUserId, ')');
            } else {
                // 自動ログイン
                liff.login();
            }
        } catch (err) {
            console.error('LIFF Initialization failed', err);
        }
    }

    // Start routing check
    // Prevent double execution by waiting for LIFF init if using real backend
    if (USE_MOCK_BACKEND) {
        handleRouting();
    } else {
        initializeLiff().then(() => {
            handleRouting();
        });
    }

    /**
     * URLパラメータに基づいて表示を切り替える
     */
    function handleRouting() {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');

        if (mode === 'history') {
            gachaContainer.classList.add('hidden');
            // 履歴に入る瞬間にコンテンツを完全に隠し、ローディングを確実に表示する
            const loadingMask = document.getElementById('historyLoadingMask');
            const realContent = document.getElementById('historyRealContent');
            if (loadingMask) loadingMask.classList.remove('hidden');
            if (realContent) realContent.classList.add('hidden');

            historyContainer.classList.remove('hidden');
            loadHistory();
        } else {
            // modeが指定されていない、またはhistory以外の時はガチャを表示
            gachaContainer.classList.remove('hidden');
            historyContainer.classList.add('hidden');
        }

        // Hide Global Loader
        const globalLoader = document.getElementById('globalLoader');
        if (globalLoader) {
            globalLoader.style.opacity = '0';
            setTimeout(() => {
                globalLoader.classList.add('hidden');
            }, 500);
        }
    }

    spinBtn.addEventListener('click', async () => {
        // ボタンが「CLOSE」モードならLIFFを閉じる
        if (spinBtn.textContent === 'CLOSE') {
            if (typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) {
                liff.closeWindow();
            } else {
                alert('ブラウザ版のため閉じません（本番のLINE内では閉じます）');
            }
            return;
        }

        const code = serialInput.value.trim();
        if (!code) {
            alert('シリアルコードを入力してください');
            return;
        }

        // Lock UI
        spinBtn.disabled = true;
        serialInput.disabled = true;

        // Start Animation (Shake)
        treasureBox.classList.add('shaking');
        // Play Move Sound
        audio.boxMove.currentTime = 0;
        audio.boxMove.play().catch(e => console.warn('Audio play error', e));

        try {
            // Call Backend
            let result;
            if (USE_MOCK_BACKEND) {
                console.log("現在デモモードで動作中...");
                result = await mockBackend(code);
            } else {
                if (!GAS_API_URL) {
                    throw new Error('API URLが設定されていません。script.jsを確認してください。');
                }
                // userNameをパラメータから削除
                const response = await fetch(`${GAS_API_URL}?action=gacha&code=${code}&userId=${currentUserId}`);
                result = await response.json();
                if (result.error) {
                    throw new Error(result.error);
                }
            }

            // Artificial delay for suspense (reduced for faster response)
            await new Promise(r => setTimeout(r, 500));

            // Stop Shake
            treasureBox.classList.remove('shaking');
            audio.boxMove.pause(); // Stop drum roll

            // Flash Effect
            flashOverlay.classList.add('flashing');

            // Switch to Open Box immediately after flash starts
            setTimeout(() => {
                treasureBox.src = ASSETS.boxOpen;

                // Play Box Open Sound
                audio.boxOpen.currentTime = 0;
                audio.boxOpen.play().catch(e => {
                    console.warn('Open sound error, forcing result', e);
                    // Fallback if sound fails
                    finalizeResult();
                });
            }, 250); // halfway through flash fade in

            // Define the result finalization logic
            const finalizeResult = () => {
                showResult(result);
                flashOverlay.classList.remove('flashing');

                // ★ メインボタンを「CLOSE」に切り替え、有効化する
                spinBtn.textContent = 'CLOSE';
                spinBtn.disabled = false;

                // Play Result Sound
                playResultSound(result.rank);
            };

            // Wait for Box Open sound to end before showing result
            audio.boxOpen.onended = finalizeResult;
            audio.boxOpen.onerror = finalizeResult; // Safety fallback

        } catch (error) {
            console.error(error);
            alert('エラーが発生しました: ' + error.message);
            resetUI();
            treasureBox.classList.remove('shaking'); // Ensure shaking stops on error
            audio.boxMove.pause(); // Ensure sound stops on error
        }
    });

    closeBtn.addEventListener('click', () => {
        resetUI();
    });

    /**
     * 結果表示（ランク対応版）
     */
    function showResult(data) {
        resultContent.innerHTML = '';

        // ランク別の背景演出クラスを追加
        resultModal.className = 'modal'; // reset classes
        if (data.rank) {
            resultModal.classList.add(`rank-${data.rank.toLowerCase()}`);
        }

        // ランクに応じた表示分岐
        switch (data.rank) {
            case 'SSR':
                showSSRResult(data);
                break;
            case 'SR':
                showSRResult(data);
                break;
            case 'R':
                showRPrizeResult(data);
                break;
            case 'POINT':
                showPointResult(data);
                break;
            case 'LOSE':
                showLoseResult(data);
                break;
            default:
                // 未定義の場合はポイント表示へ（フォールバック）
                if (data.status === 'point') {
                    showPointResult(data);
                } else {
                    showLoseResult(data);
                }
                break;
        }

        resultModal.classList.remove('hidden');
        closeBtn.classList.remove('hidden');
        closeBtn.textContent = 'CLOSE';
    }

    /**
     * 結果詳細メッセージ（LINE送信案内）を作成
     */
    function createLineSentMessage(text) {
        const wrapper = document.createElement('div');
        wrapper.className = 'line-sent-message';
        wrapper.style.marginTop = '15px';
        wrapper.style.padding = '10px';
        wrapper.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        wrapper.style.borderRadius = '8px';
        wrapper.style.textAlign = 'center';

        const icon = document.createElement('div');
        icon.textContent = '📨';
        icon.style.fontSize = '1.5rem';
        icon.style.marginBottom = '5px';

        const msg = document.createElement('div');
        msg.textContent = text || '詳細をLINEに送信しました';
        msg.style.color = '#fff';
        msg.style.fontSize = '0.9rem';

        wrapper.appendChild(icon);
        wrapper.appendChild(msg);
        return wrapper;
    }

    /**
     * SSR当選結果表示（最も豪華な演出）
     */
    function showSSRResult(data) {
        // パーティクル演出
        const particles = document.createElement('div');
        particles.className = 'ssr-particles';
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle gold';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 2 + 's';
            particle.style.animationDuration = (2 + Math.random() * 2) + 's';
            particles.appendChild(particle);
        }
        resultContent.appendChild(particles);

        // 演出画像（大きく表示）
        const img = document.createElement('img');
        img.src = ASSETS.winEffect;
        img.className = 'result-image ssr-image';
        resultContent.appendChild(img);

        // SSRバッジ
        const badge = document.createElement('div');
        badge.className = 'rank-badge ssr-badge';
        badge.innerHTML = '<span>SSR</span>';
        resultContent.appendChild(badge);

        // ランク表示
        const rankText = document.createElement('div');
        rankText.className = 'result-rank ssr-rank';
        rankText.textContent = '✨ 超激レア獲得！ ✨';
        resultContent.appendChild(rankText);

        // 景品名
        const text = document.createElement('div');
        text.className = 'result-text ssr-prize-name';
        text.textContent = data.prizeName;
        resultContent.appendChild(text);

        // ギフトコード表示 (管理ID, 当選日時を渡す)
        renderGiftCodeDisplay(data.giftCode, '#ffd700', data.wonDate, data.manageId);

        // LINE送信案内
        resultContent.appendChild(createLineSentMessage(data.message));
    }

    /**
     * SR当選結果表示（豪華な演出）
     */
    function showSRResult(data) {
        // パーティクル演出（SSRより少なめ）
        const particles = document.createElement('div');
        particles.className = 'sr-particles';
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle purple';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 2 + 's';
            particle.style.animationDuration = (2 + Math.random() * 2) + 's';
            particles.appendChild(particle);
        }
        resultContent.appendChild(particles);

        // 演出画像
        const img = document.createElement('img');
        img.src = ASSETS.winEffect;
        img.className = 'result-image sr-image';
        resultContent.appendChild(img);

        // SRバッジ
        const badge = document.createElement('div');
        badge.className = 'rank-badge sr-badge';
        badge.innerHTML = '<span>SR</span>';
        resultContent.appendChild(badge);

        // ランク表示
        const rankText = document.createElement('div');
        rankText.className = 'result-rank sr-rank';
        rankText.textContent = '🎊 激レア獲得！ 🎊';
        resultContent.appendChild(rankText);

        // 景品名
        const text = document.createElement('div');
        text.className = 'result-text sr-prize-name';
        text.textContent = data.prizeName;
        resultContent.appendChild(text);

        // ギフトコード表示
        renderGiftCodeDisplay(data.giftCode, '#bc13fe', data.wonDate, data.manageId);

        // LINE送信案内
        resultContent.appendChild(createLineSentMessage(data.message));
    }

    /**
     * R賞結果表示
     */
    function showRPrizeResult(data) {
        // 控えめなパーティクル
        const particles = document.createElement('div');
        particles.className = 'r-particles';
        for (let i = 0; i < 10; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle green';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 2 + 's';
            particle.style.animationDuration = (2 + Math.random() * 2) + 's';
            particles.appendChild(particle);
        }
        resultContent.appendChild(particles);

        // 演出画像
        const img = document.createElement('img');
        img.src = ASSETS.winEffect;
        img.className = 'result-image r-image';
        resultContent.appendChild(img);

        // Rバッジ
        const badge = document.createElement('div');
        badge.className = 'rank-badge r-badge';
        badge.innerHTML = '<span>R</span>';
        resultContent.appendChild(badge);

        // ランク表示
        const rankText = document.createElement('div');
        rankText.className = 'result-rank r-rank';
        rankText.textContent = '🎉 当たり！ 🎉';
        resultContent.appendChild(rankText);

        // 景品名
        const text = document.createElement('div');
        text.className = 'result-text r-prize-name';
        text.textContent = data.prizeName;
        resultContent.appendChild(text);

        // ギフトコード表示
        renderGiftCodeDisplay(data.giftCode, '#00ff88', data.wonDate, data.manageId);

        // LINE送信案内
        resultContent.appendChild(createLineSentMessage(data.message));
    }

    /**
     * ギフトコードの表示とコピーボタンを作成（24時間ロック機能付き）
     */
    function renderGiftCodeDisplay(giftCode, color, wonDateStr, manageId) {
        if (!giftCode) return;

        const container = document.createElement('div');
        container.className = 'gift-code-container';
        container.style.marginTop = '20px';

        // 管理IDの表示
        if (manageId) {
            const idBadge = document.createElement('div');
            idBadge.textContent = `ID: ${manageId}`;
            idBadge.style.fontSize = '0.8rem';
            idBadge.style.color = '#aaa';
            idBadge.style.marginBottom = '5px';
            idBadge.style.fontFamily = 'monospace';
            container.appendChild(idBadge);
        }

        // --- 24時間ロック判定ロジック ---
        // wonDateStr は "2024/12/31 12:00:00" のような形式を想定
        // 日付がない場合（即時配布の交換など）はロックしない
        let isLocked = false;
        let releaseDate = null;

        if (wonDateStr) {
            const wonDate = new Date(wonDateStr);
            if (!isNaN(wonDate.getTime())) {
                releaseDate = new Date(wonDate.getTime() + 24 * 60 * 60 * 1000); // 24時間後
                const now = new Date();
                if (now < releaseDate) {
                    isLocked = true;
                }
            }
        }

        // コピーボタン作成（先に作成しておく）
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-button';
        copyBtn.textContent = '📋 コードをコピー';
        copyBtn.style.width = '100%';
        copyBtn.style.padding = '8px';
        copyBtn.style.border = 'none';
        copyBtn.style.borderRadius = '5px';
        copyBtn.style.fontWeight = 'bold';

        // コードボックス作成
        const codeBox = document.createElement('div');
        codeBox.className = 'gift-code-box';
        codeBox.style.padding = '15px';
        codeBox.style.borderRadius = '5px';
        codeBox.style.fontFamily = 'monospace';
        codeBox.style.fontSize = '1.2rem';
        codeBox.style.margin = '10px 0';

        // 初期表示設定
        if (isLocked) {
            // ロック状態のスタイル
            codeBox.style.border = '1px dashed #666';
            codeBox.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            codeBox.style.color = '#ccc';

            copyBtn.style.display = 'none'; // 最初は非表示
            copyBtn.style.backgroundColor = '#555';
            copyBtn.style.color = '#aaa';
            copyBtn.style.cursor = 'not-allowed';

            // カウントダウン表示
            codeBox.innerHTML = `
                <div style="font-size: 0.9rem; margin-bottom: 8px;">🔒 ギフトコード発行待ち</div>
                <div id="countdownTimer" style="font-size: 1.4rem; font-weight: bold; color: #ffeb3b;">--:--:--</div>
                <div style="font-size: 0.8rem; color: #888; margin-top: 5px;">24時間後に表示されます</div>
            `;

            const updateTimer = () => {
                const now = new Date();
                const diff = releaseDate - now;

                if (diff <= 0) {
                    // 解除！
                    if (timerId) clearInterval(timerId);
                    isLocked = false;

                    // UI更新（ロック解除）
                    codeBox.textContent = giftCode;
                    codeBox.style.color = '#fff';
                    codeBox.style.border = `1px dashed ${color}`;

                    // コピーボタン有効化
                    copyBtn.style.display = 'block';
                    copyBtn.style.backgroundColor = color;
                    copyBtn.style.color = '#000';
                    copyBtn.style.cursor = 'pointer';
                    copyBtn.textContent = '📋 コードをコピー';
                    return;
                }

                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);

                const timerEl = document.getElementById('countdownTimer');
                if (timerEl) {
                    timerEl.textContent = `あと ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                }
            };

            // 初回実行とインターバル
            // ※ここで diff <= 0 でも copyBtn は定義済みなのでエラーにならない
            let timerId = null;
            updateTimer();
            // もしupdateTimer内で完了していたらisLockedがfalseになりUI更新される

            if (isLocked) {
                timerId = setInterval(updateTimer, 1000);
            }

        } else {
            // 通常表示
            codeBox.style.border = `1px dashed ${color}`;
            codeBox.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            codeBox.textContent = giftCode;

            // コピーボタン通常スタイル
            copyBtn.style.display = 'block';
            copyBtn.style.backgroundColor = color;
            copyBtn.style.color = '#000';
            copyBtn.style.cursor = 'pointer';
        }

        container.appendChild(codeBox);

        // コピーイベント
        copyBtn.addEventListener('click', () => {
            if (isLocked) return;
            navigator.clipboard.writeText(giftCode).then(() => {
                copyBtn.textContent = '✅ コピーしました！';
                setTimeout(() => {
                    copyBtn.textContent = '📋 コードをコピー';
                }, 2000);
            }).catch(() => {
                alert('コピーに失敗しました。手動でコピーしてください。');
            });
        });
        container.appendChild(copyBtn);
        resultContent.appendChild(container);
    }

    /**
     * 完全ハズレ表示
     */
    /**
     * ミッション表示（旧LOSE）
     */
    function showLoseResult(data) {
        // ミッションタイトル
        const title = document.createElement('div');
        title.className = 'result-text mission-title';
        title.style.color = '#fff';
        title.style.fontSize = '1.2rem';
        title.style.marginTop = '30px';
        title.style.fontWeight = 'bold';
        title.textContent = '🎲 MISSION 🎲';
        resultContent.appendChild(title);

        // ミッションテキスト
        const text = document.createElement('div');
        text.className = 'result-mission-text';
        text.style.color = '#ffeb3b';
        text.style.fontSize = '1.4rem';
        text.style.fontWeight = 'bold';
        text.style.margin = '20px 0';
        text.style.padding = '15px';
        text.style.border = '2px solid #ffeb3b';
        text.style.borderRadius = '10px';
        text.style.backgroundColor = 'rgba(255, 235, 59, 0.1)';

        // サーバーからミッションが来ていなければデフォルト
        text.textContent = data.mission || '運試し！またチャレンジしてね！';

        resultContent.appendChild(text);

        const sub = document.createElement('div');
        sub.textContent = '次回の挑戦をお待ちしています！';
        sub.style.color = '#aaa';
        sub.style.marginTop = '15px';
        sub.style.fontSize = '0.9rem';
        resultContent.appendChild(sub);
    }

    /**
     * ポイント結果表示（交換ボタン付き）
     */
    function showPointResult(data) {
        const pts = data.pointsAdded || 1;
        const current = data.currentPoints || 1;
        const target = data.targetPoints || 10;
        const percent = Math.min((current / target) * 100, 100);

        // ポイント獲得タイトル
        const title = document.createElement('div');
        title.className = 'result-text point-title';
        title.textContent = `${pts}pt GET!`;
        resultContent.appendChild(title);

        // ゲージコンテナ
        const gaugeContainer = document.createElement('div');
        gaugeContainer.className = 'points-gauge-container';
        const fill = document.createElement('div');
        fill.className = 'points-gauge-fill';
        fill.style.width = '0%'; // Animate later
        gaugeContainer.appendChild(fill);
        resultContent.appendChild(gaugeContainer);

        // 残りポイント表示
        const sub = document.createElement('p');
        sub.className = 'points-text';
        if (current >= target) {
            sub.textContent = `🎁 ${target}pt達成！交換できます！`;
            sub.classList.add('exchange-ready');
        } else {
            sub.textContent = `Amazonギフト券500円まであと ${target - current}pt`;
        }
        resultContent.appendChild(sub);

        // 交換可能な場合は交換ボタンを表示
        if (data.canExchange) {
            const exchangeBtn = document.createElement('button');
            exchangeBtn.className = 'exchange-button';
            exchangeBtn.textContent = '🎁 ギフトコードと交換する';
            exchangeBtn.addEventListener('click', () => handleExchange());
            resultContent.appendChild(exchangeBtn);
        }

        // ゲージアニメーション
        setTimeout(() => {
            fill.style.width = `${percent}%`;
        }, 100);
    }

    /**
     * ポイント交換処理
     */
    async function handleExchange() {
        const exchangeBtn = document.querySelector('.exchange-button');
        if (exchangeBtn) {
            exchangeBtn.disabled = true;
            exchangeBtn.textContent = '交換中...';
        }

        try {
            let result;
            if (USE_MOCK_BACKEND) {
                // モック交換
                result = await mockExchange();
            } else {
                // userNameを削除
                const response = await fetch(`${GAS_API_URL}?action=exchange&userId=${currentUserId}`);
                result = await response.json();
                if (result.error) {
                    throw new Error(result.error);
                }
            }

            // 交換結果を表示
            showExchangeResult(result);

        } catch (error) {
            console.error(error);
            alert('交換エラー: ' + error.message);
            if (exchangeBtn) {
                exchangeBtn.disabled = false;
                exchangeBtn.textContent = '🎁 ギフトコードと交換する';
            }
        }
    }

    /**
     * 交換結果表示
     */
    function showExchangeResult(data) {
        resultContent.innerHTML = '';

        // 成功メッセージ
        const title = document.createElement('div');
        title.className = 'result-text exchange-success';
        title.textContent = '🎉 交換完了！';
        resultContent.appendChild(title);

        // ギフトコード表示
        const codeContainer = document.createElement('div');
        codeContainer.className = 'gift-code-container';

        const codeLabel = document.createElement('p');
        codeLabel.className = 'gift-code-label';
        codeLabel.textContent = 'Amazonギフト券 500円分';
        codeContainer.appendChild(codeLabel);

        const codeBox = document.createElement('div');
        codeBox.className = 'gift-code-box';
        codeBox.textContent = data.giftCode;
        codeContainer.appendChild(codeBox);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-button';
        copyBtn.textContent = '📋 コードをコピー';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(data.giftCode).then(() => {
                copyBtn.textContent = '✅ コピーしました！';
                setTimeout(() => {
                    copyBtn.textContent = '📋 コードをコピー';
                }, 2000);
            }).catch(() => {
                alert('コピーに失敗しました。手動でコピーしてください。');
            });
        });
        codeContainer.appendChild(copyBtn);

        resultContent.appendChild(codeContainer);

        // 注意事項
        const note = document.createElement('p');
        note.className = 'gift-code-note';
        note.textContent = '※ このコードは一度だけ表示されます。必ずメモしてください。';
        resultContent.appendChild(note);
    }

    // =========================================================
    // 履歴画面ロジック
    // =========================================================

    /**
     * 履歴データを取得して描画する
     */
    async function loadHistory(showMask = true) {
        try {
            const loadingMask = document.getElementById('historyLoadingMask');
            const realContent = document.getElementById('historyRealContent');
            const prizesList = document.getElementById('prizesList');
            const exchangeList = document.getElementById('exchangeList');

            if (showMask) {
                // 初期化時にリストを完全に空にする（一瞬古いデータが見えるのを防ぐ）
                if (prizesList) prizesList.innerHTML = '';
                if (exchangeList) exchangeList.innerHTML = '';

                if (loadingMask) loadingMask.classList.remove('hidden');
                if (realContent) realContent.classList.add('hidden');
            }

            let data;
            if (USE_MOCK_BACKEND) {
                // デモ用データ（現在時刻を基準に動的生成）
                const now = new Date();
                const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1時間前（残り23時間）
                const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25時間前（ロック解除済）
                const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

                // toLocaleStringだとフォーマットがブラウザ依存になるため、ISOStringなどを使うか、整形する
                // ここでは簡易的に toISOString を使う（アプリ側でパース可能）
                const dateLocked = oneHourAgo.toISOString();
                const dateUnlocked = yesterday.toISOString();
                const dateExchange = twoDaysAgo.toISOString();

                data = {
                    prizes: [
                        { rank: 'SSR', prizeName: '✨ アルマンド・ゴールド (Lock) ✨', giftCode: 'MOCK-SSR-LOCKED', date: dateLocked, wonDate: dateLocked, manageId: 'SSR001' },
                        { rank: 'R', prizeName: '🎫 Amazonギフト券 (Open) 🎫', giftCode: 'AMZN-R100-OPEN', date: dateUnlocked, wonDate: dateUnlocked, manageId: 'R005' }
                    ],
                    exchange: [
                        { rank: 'EXCHANGE', prizeName: 'Amazonギフト券 500円分', giftCode: 'AMZN-500-EXCH', date: dateExchange, wonDate: dateExchange, manageId: 'EX001' }
                    ],
                    points: 5,
                    canExchange: false
                };
            } else {
                const response = await fetch(`${GAS_API_URL}?action=getHistory&userId=${currentUserId}`);
                data = await response.json();
            }

            renderHistory(data);
        } catch (error) {
            console.error('履歴の取得に失敗しました', error);
            alert('履歴の取得に失敗しました');
        }
    }

    /**
     * 履歴画面の描画
     */
    function renderHistory(data) {
        const prizesList = document.getElementById('prizesList');
        const exchangeList = document.getElementById('exchangeList');
        const pointDashBoard = document.getElementById('pointDashBoard');
        const currentPointsEl = document.getElementById('currentHistoryPoints');
        const exchangeBtn = document.getElementById('historyExchangeBtn');
        const pointsTabBtn = document.getElementById('pointsTabBtn');
        const loadingMask = document.getElementById('historyLoadingMask');
        const realContent = document.getElementById('historyRealContent');

        // 獲得賞品リストの作成
        const prizesFragment = document.createDocumentFragment();
        if (data.prizes.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-msg';
            empty.textContent = '獲得した賞品はありません';
            prizesFragment.appendChild(empty);
        } else {
            data.prizes.forEach(item => {
                prizesFragment.appendChild(createHistoryItem(item));
            });
        }

        // 交換履歴リストの作成
        const exchangeFragment = document.createDocumentFragment();
        if (data.exchange.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-msg';
            empty.textContent = '交換履歴はありません';
            exchangeFragment.appendChild(empty);
        } else {
            data.exchange.forEach(item => {
                exchangeFragment.appendChild(createHistoryItem(item));
            });
        }

        // DOMへの反映
        prizesList.innerHTML = '';
        prizesList.appendChild(prizesFragment);

        exchangeList.innerHTML = '';
        exchangeList.appendChild(exchangeFragment);

        // ポイント表示制御
        if (data.points > 0 || data.exchange.length > 0) {
            pointDashBoard.classList.remove('hidden');
            pointsTabBtn.classList.remove('hidden');
            currentPointsEl.textContent = data.points;

            if (data.canExchange) {
                exchangeBtn.classList.remove('hidden');
                exchangeBtn.onclick = () => handleExchange().then(() => loadHistory(false));
            } else {
                exchangeBtn.classList.add('hidden');
            }
        }

        // すべての準備が整ってから表示を切り替える (フラッシュ防止)
        // setTimeoutを入れることで、DOMの反映とクラスの適用をブラウザに確実に行わせる
        setTimeout(() => {
            if (loadingMask) loadingMask.classList.add('hidden');
            if (realContent) realContent.classList.remove('hidden');
        }, 50);
    }

    /**
     * 1つの履歴アイテム要素を作成
     */
    function createHistoryItem(item) {
        const div = document.createElement('div');
        div.className = 'history-item';

        // 日付とロック状態の判定
        let dateDisplayHtml = '不明';
        const targetDate = item.wonDate || item.date;

        if (targetDate) {
            const wonDate = new Date(targetDate);
            const releaseDate = new Date(wonDate.getTime() + 24 * 60 * 60 * 1000);
            const now = new Date();

            // EXCHANGEは即時付与なのでロック判定しない
            if (item.rank !== 'EXCHANGE' && now < releaseDate) {
                const diffMs = releaseDate - now;
                const diffMinutes = Math.ceil(diffMs / (1000 * 60)); // 分（切り上げ）

                const releaseDateStr = releaseDate.toLocaleString('ja-JP', {
                    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                let remainingText;
                if (diffMinutes <= 60) {
                    remainingText = `あと約${diffMinutes}分`;
                } else {
                    const diffHours = Math.ceil(diffMinutes / 60);
                    remainingText = `あと約${diffHours}時間`;
                }

                // ロック中の表示
                dateDisplayHtml = `<span style="color: #ff5555; font-weight:bold;">🔒 ${releaseDateStr} 解除 (${remainingText})</span>`;
            } else {
                // 通常表示
                dateDisplayHtml = wonDate.toLocaleString('ja-JP', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                });
            }
        }

        div.innerHTML = `
            <div class="item-info">
                <div class="item-date">${dateDisplayHtml}</div>
                <div class="item-name">${item.prizeName}</div>
                ${item.manageId ? `<div class="item-manage-id" style="font-size: 0.75rem; color: #888;">ID: ${item.manageId}</div>` : ''}
            </div>
            <div class="item-rank-badge item-rank-${item.rank.toLowerCase()}">${item.rank === 'EXCHANGE' ? 'GIFT' : item.rank}</div>
        `;

        // クリックで再表示
        div.addEventListener('click', () => {
            const resultData = {
                rank: item.rank,
                prizeName: item.prizeName,
                giftCode: item.giftCode,
                wonDate: item.wonDate || item.date, // wonDateがなければdateを使用
                manageId: item.manageId,
                status: item.rank === 'EXCHANGE' ? 'exchanged' : 'win',
                message: '獲得済みの景品です'
            };

            if (item.rank === 'EXCHANGE') {
                showExchangeResult(resultData);
                resultModal.classList.remove('hidden');
                closeBtn.classList.remove('hidden');
                closeBtn.textContent = 'CLOSE';
            } else {
                showResult(resultData);
            }
        });

        return div;
    }

    // タブ切り替えロジック
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // ボタンの活性状態切り替え
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // コンテンツの切り替え
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(targetTab + 'Tab').classList.add('active');
        });
    });

    function resetUI() {
        // Stop all sounds
        Object.values(audio).forEach(a => {
            a.pause();
            a.currentTime = 0;
        });


        // Reset Box
        treasureBox.src = ASSETS.boxClosed;

        // Hide Modal
        resultModal.classList.add('hidden');

        // Enable Controls
        spinBtn.disabled = false;
        spinBtn.textContent = 'OPEN'; // 表示を戻す
        serialInput.disabled = false;
        serialInput.value = '';
    }

    // =========================================================
    // Mock Backend for Logic Verification
    // =========================================================

    /**
     * モックバックエンド（ランク対応版）
     */
    async function mockBackend(code) {
        // Simulate network delay
        await new Promise(r => setTimeout(r, 1000));

        const now = new Date();
        const wonDateStr = now.toISOString();

        // テストコードパターン
        if (code === 'SSR') {
            return {
                status: 'win',
                rank: 'SSR',
                prizeName: '✨ デモ用SSR賞品 ✨',
                giftCode: 'DEMO-SSR-CODE',
                manageId: 'SSR099',
                wonDate: wonDateStr,
                message: 'おめでとうございます！24時間後にギフトコードが表示されます'
            };
        } else if (code === 'SR') {
            return {
                status: 'win',
                rank: 'SR',
                prizeName: '🎁 高級ワインセット 🎁',
                giftCode: 'DEMO-SR-CODE',
                manageId: 'SR099',
                wonDate: wonDateStr,
                message: 'おめでとうございます！24時間後にギフトコードが表示されます'
            };
        } else if (code === 'R') {
            return {
                status: 'win',
                rank: 'R',
                giftCode: 'AMZN-R100-TEST-CODE',
                prizeName: '🎫 Amazonギフト券 1,000円分 🎫',
                manageId: 'R099',
                wonDate: wonDateStr,
                message: 'おめでとうございます！24時間後にギフトコードが表示されます'
            };
        } else if (code === 'POINT') {
            // 通常ポイント（交換不可）
            return {
                status: 'point',
                rank: 'POINT',
                pointsAdded: 1,
                currentPoints: 5,
                targetPoints: 10,
                canExchange: false
            };
        } else if (code === 'POINT10') {
            // ポイント交換可能
            return {
                status: 'point',
                rank: 'POINT',
                pointsAdded: 1,
                currentPoints: 10,
                targetPoints: 10,
                targetPoints: 10,
                canExchange: true
            };
        } else if (code === 'LOSE') {
            // ミッション (LOSE)
            return {
                status: 'lose',
                rank: 'LOSE',
                mission: '【デモ】店員とハイタッチして乾杯！'
            };
        } else if (code.startsWith('TEST')) {
            // ランダムポイント（旧仕様互換）
            return {
                status: 'point',
                rank: 'POINT',
                pointsAdded: 1,
                currentPoints: Math.floor(Math.random() * 9) + 1,
                targetPoints: 10,
                canExchange: false
            };
        } else {
            throw new Error('デモモード: 無効なシリアルコードです\n\nテスト用コード:\n"SSR" → SSR当選\n"SR" → SR当選\n"R" → R賞当選\n"POINT" → ポイント獲得\n"POINT10" → 交換可能\n"LOSE" → ミッション');
        }
    }

    /**
     * モック交換処理
     */
    async function mockExchange() {
        await new Promise(r => setTimeout(r, 500));
        return {
            status: 'exchanged',
            giftCode: 'DEMO-XXXX-XXXX-XXXX',
            message: 'Amazonギフト券 500円分と交換しました！',
            remainingPoints: 0
        };
    }
});
