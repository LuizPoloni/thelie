(() => {
    const staticPreview = ['localhost', '127.0.0.1'].includes(location.hostname)
        && ['3000', '5500', '5501'].includes(location.port);
    const liveLoginUrl = 'https://thelieceramico.com.br/index.html?login=1';
    if (staticPreview && new URLSearchParams(location.search).has('login')) {
        location.replace(liveLoginUrl);
        return;
    }

    const navbar = document.getElementById('navbar');
    const heroBg = document.getElementById('heroBg');
    const mobileMenu = document.getElementById('mobileMenu');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ticking = false;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const updateScrollEffects = () => {
        const y = window.scrollY || window.pageYOffset || 0;
        navbar?.classList.toggle('scrolled', y > 60);

        if (heroBg) {
            if (reduceMotion) {
                heroBg.style.setProperty('--hero-parallax-y', '0px');
                heroBg.style.setProperty('--hero-parallax-scale', '1.03');
            } else {
                const heroHeight = Math.max(window.innerHeight, 1);
                const progress = clamp(y / heroHeight, 0, 1);
                const zoom = 1.06 + progress * 0.18;
                const translateY = Math.min(y * 0.16, heroHeight * 0.16);

                heroBg.style.setProperty('--hero-parallax-y', `${translateY.toFixed(1)}px`);
                heroBg.style.setProperty('--hero-parallax-scale', zoom.toFixed(3));
            }
        }

        ticking = false;
    };

    const requestScrollUpdate = () => {
        if (!ticking) {
            window.requestAnimationFrame(updateScrollEffects);
            ticking = true;
        }
    };

    window.addEventListener('scroll', requestScrollUpdate, { passive: true });
    window.addEventListener('resize', requestScrollUpdate);
    updateScrollEffects();

    const revealEls = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    revealEls.forEach((el) => observer.observe(el));

    const filterTabs = document.querySelectorAll('.filter-tab');
    const galeriaCards = document.querySelectorAll('.galeria-card');

    filterTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            filterTabs.forEach((item) => {
                item.classList.remove('active');
                item.setAttribute('aria-pressed', 'false');
            });

            tab.classList.add('active');
            tab.setAttribute('aria-pressed', 'true');

            const filter = tab.dataset.filter;
            galeriaCards.forEach((card) => {
                card.classList.toggle('hidden', filter !== 'all' && card.dataset.category !== filter);
            });
        });
    });

    const closeMenu = () => mobileMenu?.classList.remove('open');
    const toggleMenu = () => mobileMenu?.classList.toggle('open');

    const menuToggle = document.querySelector('[data-menu-toggle]');
    menuToggle?.addEventListener('click', toggleMenu);
    menuToggle?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleMenu();
        }
    });
    document.querySelectorAll('[data-menu-close]').forEach((item) => {
        item.addEventListener('click', closeMenu);
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMenu();
    });

    const products = new Map();
    const modal = document.getElementById('productModal');
    const modalClose = modal?.querySelector('.product-modal-close');
    let previousFocus = null;

    const fallbackProduct = (card) => ({
        title: card.querySelector('.galeria-card-name, .destaque-title')?.textContent?.trim() || 'Peça artesanal',
        kicker: card.querySelector('.galeria-card-cat, .destaque-cat')?.textContent?.trim() || 'Cerâmica',
        description: card.querySelector('.galeria-card-desc, .destaque-desc')?.textContent?.trim() || '',
        photo_url: card.querySelector('img')?.src || '',
        production_days: 30
    });

    const showProduct = (card) => {
        if (!modal) return;
        const product = products.get(card.dataset.product) || fallbackProduct(card);
        modal.querySelector('#modalImage').src = product.photo_url;
        modal.querySelector('#modalImage').alt = product.title;
        modal.querySelector('#modalCategory').textContent = product.kicker;
        modal.querySelector('#modalTitle').textContent = product.title;
        modal.querySelector('#modalDescription').textContent = product.description;
        modal.querySelector('#modalWeight').textContent = product.weight_g === null || product.weight_g === undefined
            ? 'A informar' : `${Number(product.weight_g).toLocaleString('pt-BR')} g`;
        const dimensions = [product.width_cm, product.height_cm, product.depth_cm];
        modal.querySelector('#modalMeasures').textContent = dimensions.some((value) => value === null || value === undefined)
            ? 'A informar' : `${dimensions.map((value) => Number(value).toLocaleString('pt-BR')).join(' × ')} cm`;
        modal.querySelector('#modalLeadTime').textContent = `${product.production_days || 30} dias`;
        previousFocus = document.activeElement;
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        modalClose?.focus();
    };

    const hideProduct = () => {
        if (!modal || modal.hidden) return;
        modal.hidden = true;
        document.body.style.overflow = '';
        previousFocus?.focus?.();
    };

    document.querySelectorAll('[data-product]').forEach((card) => {
        const trigger = card.querySelector('.galeria-img, .destaque-img');
        if (!trigger) return;
        trigger.setAttribute('role', 'button');
        trigger.setAttribute('tabindex', '0');
        trigger.setAttribute('aria-label', `Ver detalhes de ${fallbackProduct(card).title}`);
        trigger.addEventListener('click', () => showProduct(card));
        trigger.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                showProduct(card);
            }
        });
    });

    modal?.querySelectorAll('[data-modal-close]').forEach((item) => item.addEventListener('click', hideProduct));
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hideProduct();
        if (event.key === 'Tab' && modal && !modal.hidden) {
            const focusables = [...modal.querySelectorAll('button, a[href]')];
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });

    const loginModal = document.getElementById('loginModal');
    const loginOpen = document.getElementById('loginOpen');
    const loginForm = document.getElementById('siteLoginForm');
    const loginMessage = document.getElementById('siteLoginMessage');
    const panelLink = document.getElementById('openPanelLink');
    let loggedIn = false;

    const openPanel = () => {
        const tab = window.open('admin.html', '_blank');
        if (tab) {
            tab.opener = null;
            loginModal.hidden = true;
            document.body.style.overflow = '';
        } else {
            panelLink.hidden = false;
            loginMessage.textContent = 'A nova aba foi bloqueada. Use o link abaixo para abrir o painel.';
        }
    };

    const showLogin = () => {
        if (!loginModal) return;
        loginMessage.textContent = '';
        panelLink.hidden = true;
        loginModal.hidden = false;
        document.body.style.overflow = 'hidden';
        loginForm.elements.namedItem('username').focus();
    };

    const hideLogin = () => {
        if (!loginModal || loginModal.hidden) return;
        loginModal.hidden = true;
        document.body.style.overflow = '';
        loginOpen?.focus();
    };

    loginOpen?.addEventListener('click', async () => {
        if (staticPreview) { location.assign(liveLoginUrl); return; }
        if (!loggedIn) { showLogin(); return; }
        try {
            const response = await fetch('/api/index.php?action=me', { credentials: 'same-origin', cache: 'no-store' });
            if (!response.ok) throw new Error('Sessão encerrada');
            openPanel();
        } catch {
            loggedIn = false;
            showLogin();
        }
    });
    loginModal?.querySelectorAll('[data-login-close]').forEach((item) => item.addEventListener('click', hideLogin));
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hideLogin();
        if (event.key === 'Tab' && loginModal && !loginModal.hidden) {
            const focusables = [...loginModal.querySelectorAll('button, input, a[href]')].filter((item) => !item.hidden);
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });

    loginForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (staticPreview) { location.assign(liveLoginUrl); return; }
        const button = loginForm.querySelector('button[type="submit"]');
        button.disabled = true;
        loginMessage.textContent = '';
        try {
            const response = await fetch('/api/index.php?action=login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    username: loginForm.elements.namedItem('username').value,
                    password: loginForm.elements.namedItem('password').value
                })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'Não foi possível entrar.');
            loggedIn = true;
            loginForm.reset();
            openPanel();
        } catch (error) {
            loginMessage.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });

    fetch('/api/index.php?action=me', { credentials: 'same-origin', cache: 'no-store' })
        .then((response) => { loggedIn = response.ok; })
        .catch(() => { loggedIn = false; });
    if (new URLSearchParams(location.search).has('login')) {
        showLogin();
        history.replaceState(null, '', location.pathname + location.hash);
    }

    fetch('/api/index.php?action=products', { cache: 'no-store' })
        .then((response) => {
            if (!response.ok) throw new Error('Produtos indisponíveis');
            return response.json();
        })
        .then(({ products: rows }) => {
            rows.forEach((product) => products.set(product.slug, product));
            document.querySelectorAll('[data-product]').forEach((card) => {
                const product = products.get(card.dataset.product);
                if (!product) return;
                card.dataset.category = product.category;
                const image = card.querySelector('img');
                if (image) { image.src = product.photo_url; image.alt = product.title; }
                const trigger = card.querySelector('.galeria-img, .destaque-img');
                trigger?.setAttribute('aria-label', `Ver detalhes de ${product.title}`);
                const name = card.querySelector('.galeria-card-name, .destaque-title');
                if (name) name.textContent = product.title;
                const category = card.querySelector('.galeria-card-cat, .destaque-cat');
                if (category) category.textContent = product.kicker;
                const description = card.querySelector('.galeria-card-desc, .destaque-desc');
                if (description) description.textContent = product.description;
                const quote = card.querySelector('.destaque-poem');
                if (quote) quote.textContent = product.quote_text ? `“${product.quote_text}”` : '';
            });
        })
        .catch(() => { /* Keep the original site content visible until the database is configured. */ });
})();
