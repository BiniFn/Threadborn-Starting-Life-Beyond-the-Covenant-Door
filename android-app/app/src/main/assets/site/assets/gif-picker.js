(function() {
    const TENOR_KEY = "LIVDSRZULELA"; // Tenor Public Testing Key

    // Inject Modal HTML into body if not exists
    function injectModal() {
        if (document.getElementById("gif-modal-overlay")) return;
        const html = `
        <div id="gif-modal-overlay" class="gif-modal-overlay" style="display: none;">
            <div class="gif-modal">
                <div class="gif-modal-header">
                    <input type="text" id="gif-search-input" class="gif-modal-input" placeholder="Search GIFs..." />
                    <button id="gif-modal-close" class="gif-modal-close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div id="gif-modal-grid" class="gif-modal-grid">
                    <div style="color:var(--mist);grid-column:1/-1;text-align:center;padding:20px;">Loading GIFs...</div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        // Also inject preview image element next to the textarea
        const wrapper = document.querySelector('.chat-input-wrapper');
        if (wrapper && !document.getElementById('chat-selected-gif-preview')) {
            wrapper.insertAdjacentHTML('beforeend', '<img id="chat-selected-gif-preview" class="chat-selected-gif-preview" src="" alt="Selected GIF" />');
            wrapper.insertAdjacentHTML('beforeend', '<button id="chat-remove-gif-btn" style="display:none;position:absolute;bottom:100%;left:86px;margin-bottom:60px;z-index:11;background:rgba(0,0,0,0.8);border:none;color:white;border-radius:50%;width:24px;height:24px;cursor:pointer;">×</button>');
        }
    }

    // Tenor Fetch
    async function fetchGifs(query = "") {
        const grid = document.getElementById("gif-modal-grid");
        if (!grid) return;
        grid.innerHTML = '<div style="color:var(--mist);grid-column:1/-1;text-align:center;padding:20px;">Loading...</div>';
        
        try {
            let url;
            if (query) {
                url = `https://api.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=20`;
            } else {
                url = `https://api.tenor.com/v1/trending?key=${TENOR_KEY}&limit=20`;
            }
            const res = await fetch(url);
            const data = await res.json();
            
            if (!data.results || data.results.length === 0) {
                grid.innerHTML = '<div style="color:var(--mist);grid-column:1/-1;text-align:center;padding:20px;">No GIFs found.</div>';
                return;
            }

            grid.innerHTML = data.results.map(gif => {
                const imgUrl = gif.media[0].nanogif.url;
                const fullUrl = gif.media[0].gif.url;
                return `<img src="${imgUrl}" data-full="${fullUrl}" class="gif-item" alt="GIF" loading="lazy" />`;
            }).join('');
            
        } catch (error) {
            grid.innerHTML = '<div style="color:var(--mist);grid-column:1/-1;text-align:center;padding:20px;">Failed to load GIFs.</div>';
        }
    }

    // Init logic
    function initGifPicker() {
        injectModal();
        
        const gifBtn = document.getElementById("chat-gif-btn");
        const attachBtn = document.getElementById("chat-attach-btn");
        const fileInput = document.getElementById("reaction-image");
        const overlay = document.getElementById("gif-modal-overlay");
        const closeBtn = document.getElementById("gif-modal-close");
        const searchInput = document.getElementById("gif-search-input");
        const grid = document.getElementById("gif-modal-grid");
        const preview = document.getElementById("chat-selected-gif-preview");
        const removeBtn = document.getElementById("chat-remove-gif-btn");

        if (attachBtn && fileInput) {
            attachBtn.addEventListener('click', () => {
                fileInput.click();
            });
            // Clear GIF if real image is selected
            fileInput.addEventListener('change', () => {
                if (fileInput.files && fileInput.files.length > 0) {
                    window.selectedGifUrl = null;
                    if (preview) preview.style.display = 'none';
                    if (removeBtn) removeBtn.style.display = 'none';
                }
            });
        }

        if (gifBtn && overlay) {
            gifBtn.addEventListener('click', () => {
                window.currentGifTarget = 'main';
                overlay.style.display = 'flex';
                fetchGifs();
                if (searchInput) searchInput.focus();
            });
        }

        window.openGifModal = function(targetId) {
            window.currentGifTarget = targetId;
            const ov = document.getElementById("gif-modal-overlay");
            if (ov) {
                ov.style.display = 'flex';
                fetchGifs();
                const si = document.getElementById("gif-search-input");
                if (si) si.focus();
            }
        };

        if (closeBtn && overlay) {
            closeBtn.addEventListener('click', () => {
                overlay.style.display = 'none';
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.style.display = 'none';
            });
        }

        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    fetchGifs(e.target.value);
                }, 500);
            });
        }

        if (!window.selectedGifs) window.selectedGifs = {};

        if (grid) {
            grid.addEventListener('click', (e) => {
                if (e.target.classList.contains('gif-item')) {
                    const fullUrl = e.target.getAttribute('data-full');
                    const target = window.currentGifTarget || 'main';
                    
                    window.selectedGifs[target] = fullUrl;
                    
                    const preview = document.getElementById(target === 'main' ? 'chat-selected-gif-preview' : 'preview-' + target);
                    const removeBtn = document.getElementById(target === 'main' ? 'chat-remove-gif-btn' : 'remove-gif-' + target);
                    const fileInput = document.getElementById(target === 'main' ? 'reaction-image' : 'image-' + target);
                    
                    if (preview) {
                        preview.src = fullUrl;
                        preview.style.display = 'block';
                    }
                    if (removeBtn) {
                        removeBtn.style.display = 'block';
                    }
                    if (fileInput) fileInput.value = "";
                    
                    // Legacy fallback
                    if (target === 'main') window.selectedGifUrl = fullUrl;
                    
                    overlay.style.display = 'none';
                }
            });
        }

        window.removeGif = function(target) {
            window.selectedGifs[target] = null;
            if (target === 'main') window.selectedGifUrl = null;
            const preview = document.getElementById(target === 'main' ? 'chat-selected-gif-preview' : 'preview-' + target);
            const removeBtn = document.getElementById(target === 'main' ? 'chat-remove-gif-btn' : 'remove-gif-' + target);
            if (preview) preview.style.display = 'none';
            if (removeBtn) removeBtn.style.display = 'none';
        };

        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                window.removeGif('main');
            });
        }
        
        // Auto-resize textarea
        const textarea = document.getElementById('reaction-text');
        if (textarea) {
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
            
            // Watch for form submit to clear preview
            const form = textarea.closest('form');
            if (form) {
                form.addEventListener('submit', () => {
                    setTimeout(() => {
                        if (!window.selectedGifUrl) {
                            if (preview) preview.style.display = 'none';
                            if (removeBtn) removeBtn.style.display = 'none';
                            textarea.style.height = 'auto';
                        }
                    }, 50);
                });
            }
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGifPicker);
    } else {
        initGifPicker();
    }
})();
