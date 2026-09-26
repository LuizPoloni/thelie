(() => {
    const $ = (id) => document.getElementById(id);
    const dashboardView = $('dashboardView');
    const productForm = $('productForm');
    let user = null;
    let products = [];
    let selectedId = null;
    let previewUrl = null;

    const message = (id, text, error = false) => {
        const node = $(id);
        node.textContent = text;
        node.classList.toggle('error', error);
    };

    const request = async (action, { method = 'GET', data, formData } = {}) => {
        const headers = {};
        if (user && method !== 'GET') headers['X-CSRF-Token'] = user.csrf_token;
        if (data) headers['Content-Type'] = 'application/json';
        const response = await fetch(`/api/index.php?action=${action}`, {
            method,
            headers,
            credentials: 'same-origin',
            body: formData || (data ? JSON.stringify(data) : undefined),
            cache: 'no-store'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
        return result;
    };

    const selectProduct = (id) => {
        const product = products.find((item) => item.id === id);
        if (!product) return;
        selectedId = id;
        document.querySelectorAll('.product-option').forEach((button) => {
            button.classList.toggle('active', Number(button.dataset.id) === id);
        });
        $('productSection').textContent = product.section === 'galeria' ? 'Galeria' : 'Destaques';
        $('productHeading').textContent = product.title;
        $('productPreview').src = product.photo_url;
        $('productPreview').alt = product.title;
        $('photoInput').value = '';
        if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
        for (const field of ['title', 'category', 'kicker', 'description', 'quote_text', 'weight_g', 'width_cm', 'height_cm', 'depth_cm', 'production_days']) {
            productForm.elements.namedItem(field).value = product[field] ?? '';
        }
        productForm.hidden = false;
        message('productMessage', '');
    };

    const renderProducts = () => {
        const list = $('productList');
        list.replaceChildren();
        let currentSection = '';
        for (const product of products) {
            if (product.section !== currentSection) {
                currentSection = product.section;
                const heading = document.createElement('p');
                heading.className = 'product-group';
                heading.textContent = currentSection === 'galeria' ? 'Galeria' : 'Destaques';
                list.append(heading);
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'product-option';
            button.dataset.id = product.id;
            const img = document.createElement('img');
            img.src = product.photo_url;
            img.alt = '';
            const name = document.createElement('span');
            name.textContent = product.title;
            button.append(img, name);
            button.addEventListener('click', () => selectProduct(product.id));
            list.append(button);
        }
        if (products.length) selectProduct(selectedId && products.some((item) => item.id === selectedId) ? selectedId : products[0].id);
    };

    const loadProducts = async () => {
        const result = await request('products');
        products = result.products;
        renderProducts();
    };

    const enterDashboard = async (account) => {
        if (account.must_change_password) {
            window.location.replace('conta.html');
            return;
        }
        user = account;
        dashboardView.hidden = false;
        dashboardView.style.display = '';
        $('logoutButton').hidden = false;
        $('headerName').textContent = user.display_name || user.username;
        try { await loadProducts(); }
        catch (error) { message('productMessage', error.message, true); }
    };

    $('photoInput').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
        if (!file) return;
        if (!/\.jpe?g$/i.test(file.name) || file.type !== 'image/jpeg' || file.size > 5 * 1024 * 1024) {
            event.target.value = '';
            message('productMessage', 'Escolha um JPG de até 5 MB.', true);
            return;
        }
        previewUrl = URL.createObjectURL(file);
        $('productPreview').src = previewUrl;
        message('productMessage', 'Prévia pronta. Clique em Salvar alterações.');
    });

    productForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = productForm.querySelector('button[type="submit"]');
        button.disabled = true;
        message('productMessage', 'Salvando...');
        try {
            const data = { id: selectedId };
            for (const field of ['title', 'category', 'kicker', 'description', 'quote_text', 'weight_g', 'width_cm', 'height_cm', 'depth_cm', 'production_days']) {
                data[field] = productForm.elements.namedItem(field).value;
            }
            await request('product', { method: 'PUT', data });
            const file = $('photoInput').files[0];
            if (file) {
                const upload = new FormData();
                upload.append('id', String(selectedId));
                upload.append('photo', file);
                await request('photo-upload', { method: 'POST', formData: upload });
            }
            await loadProducts();
            message('productMessage', 'Alterações salvas no banco de dados.');
        } catch (error) { message('productMessage', error.message, true); }
        finally { button.disabled = false; }
    });

    $('logoutButton').addEventListener('click', async () => {
        try { await request('logout', { method: 'POST' }); } catch { /* Clear the local view too. */ }
        user = null;
        dashboardView.hidden = true;
        $('logoutButton').hidden = true;
        $('headerName').textContent = '';
        window.location.replace('index.html?login=1');
    });

    request('me').then(({ user: account }) => enterDashboard(account))
        .catch(() => window.location.replace('index.html?login=1'));
})();
