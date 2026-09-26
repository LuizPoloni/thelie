(() => {
    const $ = (id) => document.getElementById(id);
    const profileForm = $('profileForm');
    const passwordForm = $('passwordForm');
    let user = null;

    const message = (id, text, error = false) => {
        const node = $(id);
        node.textContent = text;
        node.classList.toggle('error', error);
    };

    const request = async (action, { method = 'GET', data } = {}) => {
        const headers = {};
        if (user && method !== 'GET') headers['X-CSRF-Token'] = user.csrf_token;
        if (data) headers['Content-Type'] = 'application/json';
        const response = await fetch(`/api/index.php?action=${action}`, {
            method, headers, credentials: 'same-origin',
            body: data ? JSON.stringify(data) : undefined, cache: 'no-store'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
        return result;
    };

    const fillProfile = () => {
        profileForm.elements.namedItem('display_name').value = user.display_name || '';
        profileForm.elements.namedItem('username').value = user.username || '';
        profileForm.elements.namedItem('email').value = user.email || '';
        profileForm.elements.namedItem('phone').value = user.phone || '';
        $('headerName').textContent = user.display_name || user.username;
        $('adminLink').hidden = user.role !== 'admin' || user.must_change_password;
        $('passwordHint').textContent = user.must_change_password
            ? 'Para começar, troque a senha temporária. Use pelo menos 12 caracteres.'
            : 'Use uma senha de pelo menos 12 caracteres.';
    };

    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = profileForm.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const data = Object.fromEntries(['display_name', 'email', 'phone'].map((key) => [key, profileForm.elements.namedItem(key).value]));
            await request('profile', { method: 'PATCH', data });
            user = (await request('me')).user;
            fillProfile();
            message('profileMessage', 'Dados pessoais salvos.');
        } catch (error) { message('profileMessage', error.message, true); }
        finally { button.disabled = false; }
    });

    passwordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const next = form.elements.namedItem('new_password').value;
        if (next !== form.elements.namedItem('confirm_password').value) {
            message('passwordMessage', 'As novas senhas não coincidem.', true);
            return;
        }
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            await request('password', { method: 'POST', data: {
                current_password: form.elements.namedItem('current_password').value,
                new_password: next
            } });
            form.reset();
            user = (await request('me')).user;
            fillProfile();
            message('passwordMessage', 'Senha alterada. Agora você pode editar as peças.');
        } catch (error) { message('passwordMessage', error.message, true); }
        finally { button.disabled = false; }
    });

    $('logoutButton').addEventListener('click', async () => {
        try { await request('logout', { method: 'POST' }); } catch { /* Clear the local view too. */ }
        user = null;
        $('accountView').hidden = true;
        window.location.replace('index.html?login=1');
    });

    request('me').then(({ user: account }) => {
        user = account;
        fillProfile();
        $('accountView').hidden = false;
        $('logoutButton').hidden = false;
    }).catch(() => window.location.replace('index.html?login=1'));
})();
