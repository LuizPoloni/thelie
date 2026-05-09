(() => {
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
})();
