document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const treasureBox = document.getElementById('treasureBox');
    const spinBtn = document.getElementById('spinBtn');
    const serialInput = document.getElementById('serialCode');
    const flashOverlay = document.getElementById('flashOverlay');
    const resultModal = document.getElementById('resultModal');
    const resultContent = document.getElementById('resultContent');
    const closeBtn = document.getElementById('closeBtn');

    // State
    const ASSETS = {
        boxClosed: 'assets/box_closed.png',
        boxOpen: 'assets/box_open.png',
        winEffect: 'assets/win_effect.png'
    };

    // -----------------------------------------------------------------
    // ★ IMPORTANT: 設定エリア
    // -----------------------------------------------------------------
    // 1. LINE Developersで発行したLIFF IDを入力してください
    const MY_LIFF_ID = '2006502233-yq0x2pDd';

    // 1. Google Apps Scriptをデプロイして発行されたURLをここに貼り付けてください。
    const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyZ1rrFqxAEyUDdYsxFl3gnfIKspX0nrJbAhjyZ0-FkZY6YapE4spEWRE1vvU0XxJutvw/exec'; 

    // 3. 本番通信を行う場合は false に、デモ（テスト）の場合は true にしてください。
    const USE_MOCK_BACKEND = false;
    // -----------------------------------------------------------------

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

    if (!USE_MOCK_BACKEND) {
        initializeLiff();
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
                // userIdとuserNameをパラメータに追加
                const response = await fetch(`${GAS_API_URL}?action=gacha&code=${code}&userId=${currentUserId}&userName=${encodeURIComponent(currentUserName)}`);
                result = await response.json();
                if (result.error) {
                    throw new Error(result.error);
                }
            }

            // Artificial delay for suspense (reduced for faster response)
            await new Promise(r => setTimeout(r, 500));

            // Stop Shake
            treasureBox.classList.remove('shaking');

            // Flash Effect
            flashOverlay.classList.add('flashing');

            // Switch to Open Box immediately after flash starts
            setTimeout(() => {
                treasureBox.src = ASSETS.boxOpen;
            }, 250); // halfway through flash fade in

            // Show Result after flash peaks
            setTimeout(() => {
                showResult(result);
                flashOverlay.classList.remove('flashing');

                // ★ メインボタンを「CLOSE」に切り替え、有効化する
                spinBtn.textContent = 'CLOSE';
                spinBtn.disabled = false;
            }, 600);

        } catch (error) {
            console.error(error);
            alert('エラーが発生しました: ' + error.message);
            resetUI();
            treasureBox.classList.remove('shaking'); // Ensure shaking stops on error
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
        resultModal.classList.remove('rank-ssr', 'rank-sr', 'rank-r', 'rank-point');
        resultModal.classList.add('rank-' + (data.rank || 'point').toLowerCase());

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
            default:
                showPointResult(data);
                break;
        }

        resultModal.classList.remove('hidden');
        closeBtn.classList.remove('hidden');
        closeBtn.textContent = 'CLOSE';
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

        // フォームリンクボタン
        if (data.formUrl) {
            const formBtn = document.createElement('a');
            formBtn.href = data.formUrl;
            formBtn.target = '_blank';
            formBtn.className = 'form-link-button ssr-form-btn';
            formBtn.textContent = '📝 景品のお届け先を入力する';
            resultContent.appendChild(formBtn);
        }
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

        // フォームリンクボタン
        if (data.formUrl) {
            const formBtn = document.createElement('a');
            formBtn.href = data.formUrl;
            formBtn.target = '_blank';
            formBtn.className = 'form-link-button sr-form-btn';
            formBtn.textContent = '📝 景品のお届け先を入力する';
            resultContent.appendChild(formBtn);
        }
    }

    /**
     * R賞結果表示（シンプルな演出）
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
        rankText.textContent = '🎁 R賞 獲得！';
        resultContent.appendChild(rankText);

        // 景品名
        const text = document.createElement('div');
        text.className = 'result-text r-prize-name';
        text.textContent = data.prizeName;
        resultContent.appendChild(text);

        // 店舗受取メッセージ
        const pickup = document.createElement('div');
        pickup.className = 'pickup-message';
        pickup.innerHTML = `
            <p>🎉 おめでとうございます！</p>
            <p class="pickup-instruction">店舗スタッフにこの画面をお見せください</p>
        `;
        resultContent.appendChild(pickup);
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
                const response = await fetch(`${GAS_API_URL}?action=exchange&userId=${currentUserId}&userName=${encodeURIComponent(currentUserName)}`);
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

    function resetUI() {
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

        // テストコードパターン
        if (code === 'SSR') {
            return {
                status: 'win',
                rank: 'SSR',
                prizeName: '✨ アルマンド・ゴールド ✨',
                formUrl: 'https://forms.google.com/example'
            };
        } else if (code === 'SR') {
            return {
                status: 'win',
                rank: 'SR',
                prizeName: '🎁 高級ワインセット 🎁',
                formUrl: 'https://forms.google.com/example'
            };
        } else if (code === 'R') {
            return {
                status: 'win',
                rank: 'R',
                prizeName: '🎫 Amazonギフト券 1,000円分 🎫',
                pickupMessage: 'おめでとうございます！店舗スタッフにこの画面をお見せください。'
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
                canExchange: true
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
            throw new Error('デモモード: 無効なシリアルコードです\n\nテスト用コード:\n"SSR" → SSR当選\n"SR" → SR当選\n"R" → R賞当選\n"POINT" → ポイント獲得\n"POINT10" → 交換可能');
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
