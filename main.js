// متغيرات لحفظ حالة السفر والأصحاح وملف الكتاب المقدس
let bibleTextData = null;
let currentBookID = 40;
let currentChapterNum = 1;

// دالة تحويل رقم المزمور من الترتيب العبري (فان دايك) إلى الترتيب السبعيني (القبطي والأجبية)
function getLxxPsalmNumber(n) {
    n = parseInt(n);
    if (isNaN(n)) return n;
    if (n >= 1 && n <= 8) return n;
    if (n === 9 || n === 10) return 9;
    if (n >= 11 && n <= 113) return n - 1;
    if (n === 114 || n === 115) return 113;
    if (n === 116) return 114;
    if (n >= 117 && n <= 146) return n - 1;
    if (n === 147) return 146;
    if (n >= 148 && n <= 150) return n;
    return n;
}

document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentBookID = parseInt(urlParams.get('id')) || parseInt(urlParams.get('book')) || 40; 
    currentChapterNum = parseInt(urlParams.get('chapter')) || 1;

    // تهيئة قوائم التنقل السريع بالصفحة
    const bookSelect = document.getElementById('bookSelect');
    const chapterSelect = document.getElementById('chapterSelect');

    // تحميل النص من svd.json أولاً للاستفادة منه في بناء الأصحاحات
    await loadBibleTextData();

    if (bookSelect && chapterSelect) {
        // ملء قائمة الأسفار الـ 66
        bookSelect.innerHTML = "";
        for (let id = 1; id <= 66; id++) {
            if (arabicNames[id]) {
                const opt = document.createElement('option');
                opt.value = id;
                opt.text = arabicNames[id];
                if (id === currentBookID) opt.selected = true;
                bookSelect.appendChild(opt);
            }
        }

        // بناء قائمة الأصحاحات للسفر الحالي وملئها
        updateChapterDropdown(currentBookID, currentChapterNum);

        // الاستماع لتغيير السفر
        bookSelect.addEventListener('change', async () => {
            const newBookID = parseInt(bookSelect.value);
            currentBookID = newBookID;
            currentChapterNum = 1; // إعادة الضبط لأول أصحاح بالسفر الجديد
            updateChapterDropdown(newBookID, 1);
            await updateReadingContent(newBookID, 1);
        });

        // الاستماع لتغيير الأصحاح
        chapterSelect.addEventListener('change', async () => {
            const newChapterNum = parseInt(chapterSelect.value);
            currentChapterNum = newChapterNum;
            await updateReadingContent(currentBookID, newChapterNum);
        });
    }

    // تهيئة خيارات مصدر الصوت
    initAudioSourceToggle();

    // تشغيل العرض الأولي
    await updateReadingContent(currentBookID, currentChapterNum, true);
});

// دالة تحميل ملف svd.json في الذاكرة
async function loadBibleTextData() {
    try {
        const response = await fetch('./svd.json');
        if (!response.ok) throw new Error("ملف svd.json غير موجود");
        bibleTextData = await response.json();
    } catch (err) {
        console.error("خطأ أثناء تحميل svd.json:", err);
    }
}

// دالة تحديث قائمة الأصحاحات المنسدلة بناءً على السفر المختار
function updateChapterDropdown(bookId, selectChapterNum) {
    const chapterSelect = document.getElementById('chapterSelect');
    if (!chapterSelect || !bibleTextData) return;

    const book = bibleTextData.books ? bibleTextData.books.find(b => b.id == bookId) : bibleTextData[bookId - 1];
    if (!book) return;

    const chaptersCount = book.chapters.length;
    chapterSelect.innerHTML = "";

    for (let i = 1; i <= chaptersCount; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        let optText = `الأصحاح ${i}`;
        if (bookId == 19) {
            optText += ` (مزمور ${getLxxPsalmNumber(i)} بالترتيب القبطي)`;
        }
        opt.text = optText;
        if (i === selectChapterNum) opt.selected = true;
        chapterSelect.appendChild(opt);
    }
}

// دالة تحديث المحتوى النصي والصوتي ورابط العنوان دون إعادة تحميل الصفحة
async function updateReadingContent(bookId, chapterNum, isInitial = false) {
    // 1. تحديث عنوان الصفحة المقروء
    const titleH1 = document.getElementById('book-title');
    if (titleH1) {
        let titleText = arabicNames[bookId] || "السفر المختار";
        if (bookId == 19) {
            titleText = `مزمور ${getLxxPsalmNumber(chapterNum)} (المزامير ${chapterNum})`;
        }
        titleH1.innerText = titleText;
    }

    // 2. تحديث الرابط في شريط عنوان المتصفح دون إعادة تحميل الصفحة (HTML5 PushState)
    if (!isInitial) {
        const newUrl = `${window.location.pathname}?id=${bookId}&chapter=${chapterNum}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }

    // 3. تحديث الصوت والروابط الخارجية
    updateAudioPlayer(bookId, chapterNum);

    // 4. عرض نص الأصحاح المختار
    renderChapterText(bookId, chapterNum);
}

// دالة عرض نص أصحاح محدد
function renderChapterText(bookId, chapterNum) {
    const textDiv = document.getElementById('text-content');
    if (!textDiv) return;

    if (!bibleTextData) {
        textDiv.innerHTML = "فشل تحميل النص. تأكد من وجود ملف svd.json بجانب ملفات الموقع.";
        return;
    }

    try {
        const book = bibleTextData.books ? bibleTextData.books.find(b => b.id == bookId) : bibleTextData[bookId - 1];

        if (book) {
            textDiv.innerHTML = ""; 
            
            // نأخذ الأصحاح المحدد فقط لعرضه للحد من تباعد المسافات والتحميل الطويل
            const chapterIndex = chapterNum - 1;
            const chapter = book.chapters[chapterIndex];
            
            if (chapter) {
                let html = `<h3 id="chapter-${chapterNum}" class="chapter-header" style="color:#ffd700; margin-top:20px; border-bottom: 1px solid rgba(255,215,0,0.3); padding-bottom:5px;">الأصحاح ${chapterNum}</h3>`;
                let verses = chapter.verses || chapter;
                
                verses.forEach((v, vIdx) => {
                    let text = (typeof v === 'string') ? v : (v.text || v.content);
                    // تقليل المسافات السفلية وتباين الأسطر
                    html += `<p class="verse-p" style="margin-bottom:8px; line-height:1.6; color:#fff; font-size:1.35rem;">
                                <span class="v-number" style="color:#ffd700; font-weight:bold; margin-left:8px;">${vIdx + 1}</span>${text}
                             </p>`;
                });
                textDiv.innerHTML = html;
                
                // تمرير النص للبداية بمرونة
                textDiv.scrollTop = 0;
            }
        }
    } catch (err) {
        console.error(err);
        textDiv.innerHTML = "حدث خطأ أثناء تحميل أصحاح السفر.";
    }
}

// دالة تهيئة أزرار تبديل مصدر الصوت وحفظ الاختيار
function initAudioSourceToggle() {
    const radioButtons = document.querySelectorAll('input[name="audioSource"]');
    const lblLocal = document.getElementById('lbl-local');
    const lblOnline = document.getElementById('lbl-online');

    // قراءة القيمة المخزنة أو تعيين المحلي كافتراضي
    const savedSource = localStorage.getItem('audioSource') || 'local';

    // تعيين حالة الاختيار المبدئية
    radioButtons.forEach(radio => {
        if (radio.value === savedSource) {
            radio.checked = true;
        }
        
        radio.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            localStorage.setItem('audioSource', selectedValue);
            updateToggleUI(selectedValue);
            updateAudioPlayer(currentBookID, currentChapterNum);
        });
    });

    updateToggleUI(savedSource);

    function updateToggleUI(value) {
        if (value === 'online') {
            lblOnline?.classList.add('active');
            lblLocal?.classList.remove('active');
        } else {
            lblLocal?.classList.add('active');
            lblOnline?.classList.remove('active');
        }
    }
}

// دالة تحديث وتشغيل مشغل الصوت بناءً على مصدر الصوت المختار
function updateAudioPlayer(bookId, chapterNum) {
    const player = document.getElementById('bible-audio');
    const playerContainer = document.querySelector('.player-container');
    const externalLink = document.getElementById('external-audio-link');
    
    // 1. تحديث رابط الاستماع الخارجي (موقع Wordproject)
    if (externalLink) {
        const paddedBookId = String(bookId).padStart(2, '0');
        externalLink.href = `https://www.wordproject.org/bibles/ar/${paddedBookId}/${chapterNum}.htm`;
    }

    if (!player) return;

    // 2. إزالة أي رسالة تنبيه قديمة متعلقة بمصدر الصوت
    const oldInfo = document.getElementById('audio-info-msg');
    if (oldInfo) oldInfo.remove();

    // 3. قراءة مصدر الصوت
    let selectedSource = localStorage.getItem('audioSource') || 'local';
    const isOldTestament = bookId < 40;
    let fallbackToOnline = false;

    // إذا كان السفر من العهد القديم، نحول قسرياً إلى البث من الإنترنت
    if (isOldTestament && selectedSource === 'local') {
        selectedSource = 'online';
        fallbackToOnline = true;
    }

    // 4. تعيين الملف الصوتي والتشغيل
    if (selectedSource === 'online') {
        player.style.display = 'block';
        player.src = `https://www.wordproaudio.net/bibles/app/audio/16/${bookId}/${chapterNum}.mp3`;
        player.load();
        
        // إظهار تنبيه لطيف للمستخدم في حالة التحويل التلقائي للعهد القديم
        if (fallbackToOnline && playerContainer) {
            const infoMsg = document.createElement('div');
            infoMsg.id = 'audio-info-msg';
            infoMsg.style.color = '#ffd700';
            infoMsg.style.fontSize = '0.8rem';
            infoMsg.style.fontWeight = 'bold';
            infoMsg.style.textAlign = 'center';
            infoMsg.style.padding = '6px';
            infoMsg.style.background = 'rgba(0, 0, 0, 0.4)';
            infoMsg.style.borderRadius = '10px';
            infoMsg.style.border = '1px dashed rgba(255, 215, 0, 0.3)';
            infoMsg.style.marginTop = '8px';
            infoMsg.innerText = "🌐 تشغيل عبر الإنترنت لعدم توفر ملفات محلية للعهد القديم";
            playerContainer.appendChild(infoMsg);
        }
    } else {
        // تشغيل محلي (للعهد الجديد فقط)
        if (bookId >= 40) {
            player.style.display = 'block';
            const audioIndex = bookId - 39;
            if (audioFiles[audioIndex]) {
                player.src = `./audio/${audioFiles[audioIndex]}`; 
                player.load();
                console.log("تشغيل الصوت المحلي للعهد الجديد:", player.src);
            }
        } else {
            player.style.display = 'none';
        }
    }
}