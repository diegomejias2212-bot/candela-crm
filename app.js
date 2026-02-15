// Candela CRM App
let data = {};
let ventasFilter = 'todas';
let currentUser = null;

// === API WRAPPER ===
const api = {
    token: localStorage.getItem('candela_token'),

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': this.token ? `Bearer ${this.token}` : ''
        };
    },

    async request(url, method = 'GET', body = null) {
        try {
            const opts = { method, headers: this.getHeaders() };
            if (body) opts.body = JSON.stringify(body);

            const res = await fetch(url, opts);

            if (res.status === 401) {
                logout(); // Token expired or invalid
                return null;
            }

            return await res.json();
        } catch (e) {
            console.error('API Error:', e);
            throw e;
        }
    },

    get(url) { return this.request(url, 'GET'); },
    post(url, body) { return this.request(url, 'POST', body); },
    push(arrayName, item) { return this.request(`/api/push?array=${arrayName}`, 'POST', item); }
};

// === AUTH ===
async function checkAuth() {
    const token = localStorage.getItem('candela_token');

    if (token) {
        api.token = token;
        try {
            const user = await api.get('/api/me');
            if (user && user.username) {
                currentUser = user;
                localStorage.setItem('candela_user', JSON.stringify(user));

                // Update header
                const headerUser = document.getElementById('header-username');
                if (headerUser) headerUser.textContent = user.username;

                document.getElementById('login-overlay').classList.remove('active');
                // Show Admin Tab if admin
                if (user.username === 'admin') {
                    document.getElementById('nav-suscriptores').style.display = 'block';
                }

                loadData();
            } else {
                logout();
            }
        } catch (e) {
            logout();
        }
    } else {
        document.getElementById('login-overlay').classList.add('active');
    }
}

async function login() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const errorMsg = document.getElementById('login-error');

    console.log('Intento de login:', user);

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });

        console.log('Login Status:', res.status);
        const json = await res.json();
        console.log('Login Response:', json);

        if (res.ok) {
            localStorage.setItem('candela_token', json.token);
            // Force reload to clear any stale state
            location.reload();
        } else {
            errorMsg.textContent = json.error || 'Error de login';
            errorMsg.style.display = 'block';
        }
    } catch (e) {
        console.error('Login Error:', e);
        errorMsg.textContent = 'Error de conexión: ' + e.message;
        errorMsg.style.display = 'block';
    }
}

let isRegisterMode = false;
function toggleRegisterMode() {
    isRegisterMode = !isRegisterMode;
    const btn = document.getElementById('btn-login');
    const link = document.getElementById('btn-register-mode');
    const title = document.querySelector('#login-overlay .modal-title');

    if (isRegisterMode) {
        title.textContent = '📝 Crear Cuenta';
        btn.textContent = 'Registrarse';
        btn.onclick = register;
        link.textContent = 'Volver a Login';
    } else {
        title.textContent = '🔐 Iniciar Sesión';
        btn.textContent = 'Entrar';
        btn.onclick = login;
        link.textContent = 'Crear Cuenta';
    }
}

async function register() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const errorMsg = document.getElementById('login-error');

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            body: JSON.stringify({ username: user, password: pass })
        });

        const json = await res.json();

        if (res.ok) {
            alert('Cuenta creada. Ahora inicia sesión.');
            toggleRegisterMode();
        } else {
            errorMsg.textContent = json.error || 'Error al registrar';
            errorMsg.style.display = 'block';
        }
    } catch (e) {
        errorMsg.textContent = 'Error de conexión';
        errorMsg.style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem('candela_token');
    localStorage.removeItem('candela_user');
    location.reload();
}

// === SAAS UI ===
function openProfile() {
    if (!currentUser) return;
    document.getElementById('profile-user').textContent = currentUser.username;

    const planBadge = document.getElementById('profile-plan');
    const uBtn = document.getElementById('btn-upgrade');
    const exp = document.getElementById('profile-expires');

    if (currentUser.plan === 'pro') {
        planBadge.textContent = 'PLAN PRO 💎';
        planBadge.style.background = 'var(--accent)';
        planBadge.style.color = 'black';
        uBtn.style.display = 'none';
        if (currentUser.plan_expires) {
            const date = new Date(currentUser.plan_expires).toLocaleDateString();
            exp.textContent = `Renueva el: ${date}`;
        }
    } else {
        planBadge.textContent = 'PLAN GRATUITO';
        planBadge.style.background = 'var(--bg-secondary)';
        planBadge.style.color = 'var(--text-secondary)';
        uBtn.style.display = 'block';
        exp.textContent = 'Funciones limitadas';
    }

    document.getElementById('profile-overlay').classList.add('active');
}

function closeProfile() {
    document.getElementById('profile-overlay').classList.remove('active');
}

function openUpgrade() {
    closeProfile();
    document.getElementById('upgrade-overlay').classList.add('active');
}

function closeUpgrade() {
    document.getElementById('upgrade-overlay').classList.remove('active');
}

async function processUpgrade() {
    if (confirm('¿Confirmar pago simulado de $13 USD?')) {
        try {
            const res = await api.post('/api/upgrade', {});
            if (res && res.success) {
                alert('¡Bienvenido a Candela PRO! 💎');
                closeUpgrade();
                checkAuth(); // Refresh
            }
        } catch (e) {
            alert('Error en el pago');
        }
    }
}

// === DATA ===
async function loadData() {
    try {
        console.log('🚀 loadData initiating...');
        const res = await api.get('/api/data');

        if (!res) {
            console.error('❌ No response from /api/data');
            return;
        }

        console.log('✅ Data received from API:', Object.keys(res).length, 'keys');
        // alert('Debug: Datos recibidos del servidor. Ventas: ' + (res.ventas ? res.ventas.length : 0));

        data = res;
        // Inicializar arrays vacíos si es nueva cuenta
        ['ventas', 'gastos', 'clientes', 'tareas', 'inventario', 'ventasLocales', 'ventasWeb', 'cierresCaja'].forEach(k => {
            if (!data[k]) data[k] = [];
        });

        console.log('🔄 Calling renderAll...');
        renderAll();
        setupVentasFilters();
        setupClientSearch();
    } catch (err) {
        console.error('❌ Error cargando datos:', err);
        alert('Error Crítico: ' + err.message);
    }
}

// Legacy save (overwrite) - used for edits or small updates
async function saveData() {
    try {
        await api.post('/api/data', data);
        showToast();
        // No reload needed as we updated local state
    } catch (err) {
        console.error('Error guardando:', err);
    }
}

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

function renderAll() {
    console.log('🎨 renderAll executing...');

    // Admin check
    if (currentUser && currentUser.username === 'admin') {
        renderSuscriptores();
    }
    try {
        renderStats();
        renderMetasProgress();
        renderMetasOverview();
        renderEstadoResultados();
        renderVentasResumen();
        renderVentas();
        renderFlujo();
        renderAgentes();
        renderPlanes();
        renderClientes();
        renderCalendario();
        renderTareas();
        renderInventario();
        renderUrgentTasks();
        renderCajaDiaria();
        console.log('✅ renderAll completed successfully');
    } catch (e) {
        console.error('❌ Error inside renderAll:', e);
        alert('Error Renderizando: ' + e.message);
    }
}

function setupVentasFilters() {
    document.querySelectorAll('#ventas-filters .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#ventas-filters .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            ventasFilter = btn.dataset.filter;
            renderVentas();
        });
    });
}

function setupClientSearch() {
    const search = document.getElementById('venta-client-search');
    if (search) {
        search.addEventListener('input', () => {
            renderVentas();
        });
    }
}

function renderVentasResumen() {
    if (!data.ventas) return;
    const pagadas = data.ventas.filter(v => v.pagado);
    const pendientes = data.ventas.filter(v => !v.pagado);
    const sinFactura = data.ventas.filter(v => !v.facturado);

    const totalPagado = pagadas.reduce((s, v) => s + v.monto, 0);
    const totalPendiente = pendientes.reduce((s, v) => s + v.monto, 0);
    const totalSinFactura = sinFactura.reduce((s, v) => s + v.monto, 0);

    // Calcular IVA Acumulado (19% de impuestos incluidos en el total)
    // Formula: IVA = Total - (Total / 1.19)
    const totalIVA = data.ventas.reduce((s, v) => s + (v.monto - (v.monto / 1.19)), 0);

    document.getElementById('ventas-resumen').innerHTML = `
        <div class="stat-card">
            <div class="stat-value" style="color:var(--success)">$${(totalPagado / 1000).toFixed(0)}k</div>
            <div class="stat-label">✅ Pagado (${pagadas.length})</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color:var(--danger)">$${(totalPendiente / 1000).toFixed(0)}k</div>
            <div class="stat-label">💵 Por Cobrar (${pendientes.length})</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color:var(--warning)">$${(totalIVA / 1000).toFixed(0)}k</div>
            <div class="stat-label">📉 IVA Acumulado</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.ventas.length}</div>
            <div class="stat-label">Total Ventas</div>
        </div>
    `;
}

function renderFlujo() {
    if (!data.gastos) data.gastos = [];
    if (!data.ventasWeb) data.ventasWeb = [];

    const hoy = new Date();
    const mesActual = hoy.toISOString().substring(0, 7);

    // === INGRESOS ===
    const ventasB2Bmes = data.ventas ? data.ventas.filter(v => v.pagado && v.fecha.startsWith(mesActual)) : [];
    const ventasLocalMes = data.ventasLocales ? data.ventasLocales.filter(v => v.fecha.startsWith(mesActual)) : [];
    const ventasWebMes = data.ventasWeb ? data.ventasWeb.filter(v => v.fecha.startsWith(mesActual)) : [];

    const ingB2B = ventasB2Bmes.reduce((s, v) => s + v.monto, 0);
    const ingLocal = ventasLocalMes.reduce((s, v) => s + v.monto, 0);
    const ingWeb = ventasWebMes.reduce((s, v) => s + v.monto, 0);
    const totalIngresos = ingB2B + ingLocal + ingWeb;

    // === POR COBRAR ===
    const porCobrar = data.ventas ? data.ventas.filter(v => !v.pagado) : [];
    const totalPorCobrar = porCobrar.reduce((s, v) => s + v.monto, 0);

    // === EGRESOS ===
    const gastosMes = data.gastos.filter(g => g.fecha.startsWith(mesActual));
    const totalGastosMes = gastosMes.reduce((s, g) => s + g.monto, 0);

    // === BALANCE ===
    const balance = totalIngresos - totalGastosMes;

    // Resumen KPIs
    document.getElementById('flujo-resumen').innerHTML = `
        <div class="stat-card" style="border-top: 3px solid var(--success)">
            <div class="stat-value" style="color:var(--success)">$${totalIngresos.toLocaleString()}</div>
            <div class="stat-label">📥 Ingresos ${mesActual}</div>
        </div>
        <div class="stat-card" style="border-top: 3px solid var(--danger)">
            <div class="stat-value" style="color:var(--danger)">$${totalGastosMes.toLocaleString()}</div>
            <div class="stat-label">📤 Egresos ${mesActual}</div>
        </div>
        <div class="stat-card" style="border-top: 3px solid var(--accent)">
            <div class="stat-value" style="color:${balance >= 0 ? 'var(--success)' : 'var(--danger)'}">$${balance.toLocaleString()}</div>
            <div class="stat-label">💰 Balance Mes</div>
        </div>
        <div class="stat-card" style="border-top: 3px solid var(--warning)">
            <div class="stat-value" style="color:var(--warning)">$${totalPorCobrar.toLocaleString()}</div>
            <div class="stat-label">💵 Por Cobrar (${porCobrar.length})</div>
        </div>
    `;

    // === INGRESOS DETALLADOS ===
    let ingresosHTML = `
        <div class="card" style="margin-bottom:0.5rem">
            <div class="kpi-grid">
                <div class="kpi-item"><span>🏢 B2B Mayorista</span><span style="font-weight:700;color:var(--success)">$${ingB2B.toLocaleString()} (${ventasB2Bmes.length})</span></div>
                <div class="kpi-item"><span>🏪 Local (Cafetería)</span><span style="font-weight:700;color:var(--success)">$${ingLocal.toLocaleString()} (${ventasLocalMes.length})</span></div>
                <div class="kpi-item"><span>🌐 Web (Shopify)</span><span style="font-weight:700;color:var(--success)">$${ingWeb.toLocaleString()} (${ventasWebMes.length})</span></div>
            </div>
        </div>
    `;

    // Lista de ventas pagadas del mes
    const ventasPagadasMes = ventasB2Bmes.concat(ventasWebMes).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    ingresosHTML += ventasPagadasMes.slice(0, 10).map(v => `
        <div class="card" style="padding:0.75rem;margin-bottom:0.25rem">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                    <span style="font-weight:600">${v.cliente}</span>
                    <span class="badge badge-${v.canal === 'web' ? 'educacion' : 'b2b'}" style="margin-left:0.5rem">${v.canal === 'web' ? '🌐 Web' : '🏢 B2B'}</span>
                </div>
                <span style="color:var(--success);font-weight:700">+$${v.monto.toLocaleString()}</span>
            </div>
            <div style="font-size:0.7rem;color:var(--text-secondary);margin-top:0.25rem">📅 ${v.fecha}</div>
        </div>
    `).join('');

    document.getElementById('flujo-ingresos-lista').innerHTML = ingresosHTML || '<div class="card">Sin ingresos este mes.</div>';

    // === POR COBRAR + FACTURAS PENDIENTES (últimos 2 meses) ===
    const hace2Meses = new Date();
    hace2Meses.setMonth(hace2Meses.getMonth() - 2);
    const fechaCorte = hace2Meses.toISOString().split('T')[0];

    const sinFactura = data.ventas ? data.ventas.filter(v => !v.facturado && v.fecha >= fechaCorte) : [];
    const totalSinFactura = sinFactura.reduce((s, v) => s + v.monto, 0);

    let cobrarHTML = '';

    // KPI resumen
    cobrarHTML += `
        <div class="card" style="margin-bottom:0.5rem">
            <div class="kpi-grid">
                <div class="kpi-item"><span>💵 Por Cobrar</span><span style="font-weight:700;color:var(--warning)">$${totalPorCobrar.toLocaleString()} (${porCobrar.length})</span></div>
                <div class="kpi-item"><span>📄 Sin Factura (2 meses)</span><span style="font-weight:700;color:var(--danger)">$${totalSinFactura.toLocaleString()} (${sinFactura.length})</span></div>
            </div>
        </div>
    `;

    // Ventas no pagadas
    if (porCobrar.length) {
        cobrarHTML += `<div style="font-size:0.8rem;font-weight:600;margin:0.5rem 0;color:var(--warning)">💵 PENDIENTES DE PAGO</div>`;
        cobrarHTML += porCobrar.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 15).map(v => `
            <div class="card" style="padding:0.75rem;margin-bottom:0.25rem;border-left:3px solid var(--warning)">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <span style="font-weight:600">${v.cliente}</span>
                        <span class="badge badge-pendiente" style="margin-left:0.5rem">No Pagado</span>
                    </div>
                    <span style="color:var(--warning);font-weight:700">$${v.monto.toLocaleString()}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-secondary);margin-top:0.25rem">
                    <span>📅 ${v.fecha} · ${v.kg || 0}kg</span>
                    <button onclick="marcarPagado(${v.id})" style="background:var(--success);color:white;border:none;padding:0.15rem 0.5rem;border-radius:4px;cursor:pointer;font-size:0.7rem">✅ Marcar Pagado</button>
                </div>
            </div>
        `).join('');
    }

    // Facturas pendientes de últimos 2 meses
    if (sinFactura.length) {
        cobrarHTML += `<div style="font-size:0.8rem;font-weight:600;margin:0.75rem 0 0.5rem;color:var(--danger)">📄 SIN FACTURA (últimos 2 meses)</div>`;
        cobrarHTML += sinFactura.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 15).map(v => `
            <div class="card" style="padding:0.75rem;margin-bottom:0.25rem;border-left:3px solid var(--danger)">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <span style="font-weight:600">${v.cliente}</span>
                        <span class="badge badge-alta" style="margin-left:0.5rem">Sin Factura</span>
                        ${v.pagado ? '<span class="badge badge-activo" style="margin-left:0.25rem">Pagado</span>' : '<span class="badge badge-pendiente" style="margin-left:0.25rem">No Pagado</span>'}
                    </div>
                    <span style="color:var(--danger);font-weight:700">$${v.monto.toLocaleString()}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-secondary);margin-top:0.25rem">
                    <span>📅 ${v.fecha} · ${v.kg || 0}kg</span>
                    <button onclick="marcarFacturado(${v.id})" style="background:var(--accent);color:white;border:none;padding:0.15rem 0.5rem;border-radius:4px;cursor:pointer;font-size:0.7rem">📄 Marcar Facturado</button>
                </div>
            </div>
        `).join('');
    }

    if (!porCobrar.length && !sinFactura.length) {
        cobrarHTML += '<div class="card">🎉 ¡Todo al día!</div>';
    }

    document.getElementById('flujo-por-cobrar').innerHTML = cobrarHTML;


    // === EGRESOS ===
    const categorias = {
        'fijo': { emoji: '🏠' }, 'variable': { emoji: '📉' }, 'materia_prima': { emoji: '☕' },
        'logistica': { emoji: '🚚' }, 'marketing': { emoji: '📣' }, 'otros': { emoji: '📋' }
    };

    document.getElementById('flujo-grid').innerHTML = gastosMes.length ? gastosMes.map(g => `
        <div class="card">
            <div class="card-header">
                <span class="card-title">${categorias[g.categoria]?.emoji || '📋'} ${g.descripcion}</span>
                <span class="badge badge-${g.categoria === 'fijo' ? 'b2b' : g.categoria === 'variable' ? 'proceso' : 'idea'}">${g.categoria}</span>
            </div>
            <div style="font-size:1.5rem;font-weight:700;color:var(--danger)">-$${g.monto.toLocaleString()}</div>
            <div class="card-meta">
                <span class="card-detail">📅 ${g.fecha}</span>
                ${g.notas ? `<span class="card-detail">📝 ${g.notas}</span>` : ''}
            </div>
        </div>
    `).join('') : '<div class="card">No hay gastos este mes.</div>';
}


function renderCajaDiaria() {
    const hoy = new Date().toISOString().split('T')[0];
    const ventasHoy = data.ventasLocales ? data.ventasLocales.filter(v => v.fecha === hoy) : [];
    const totalHoy = ventasHoy.reduce((s, v) => s + v.monto, 0);

    const efectivo = ventasHoy.filter(v => v.metodo === 'efectivo').reduce((s, v) => s + v.monto, 0);
    const tarjeta = ventasHoy.filter(v => v.metodo === 'tarjeta').reduce((s, v) => s + v.monto, 0);
    const transferencia = ventasHoy.filter(v => v.metodo === 'transferencia').reduce((s, v) => s + v.monto, 0);

    document.getElementById('caja-resumen').innerHTML = `
        <div class="stat-card"><div class="stat-value">$${totalHoy.toLocaleString()}</div><div class="stat-label">Ventas Hoy</div></div>
        <div class="stat-card"><div class="stat-value">$${efectivo.toLocaleString()}</div><div class="stat-label">💵 Efectivo</div></div>
        <div class="stat-card"><div class="stat-value">$${tarjeta.toLocaleString()}</div><div class="stat-label">💳 Tarjeta</div></div>
        <div class="stat-card"><div class="stat-value">$${transferencia.toLocaleString()}</div><div class="stat-label">📲 Transf</div></div>
    `;

    document.getElementById('ventas-locales-lista').innerHTML = ventasHoy.length ? ventasHoy.map(v => `
        <div class="card" style="padding:0.75rem">
            <div style="display:flex;justify-content:space-between">
                <span style="font-weight:600">${v.items}</span>
                <span style="color:var(--success);font-weight:700">$${v.monto.toLocaleString()}</span>
            </div>
            <div class="card-meta" style="font-size:0.7rem">
                <span>🕒 ${v.hora}</span>
                <span>💳 ${v.metodo}</span>
            </div>
        </div>
    `).reverse().join('') : '<div class="card">No hay ventas registradas hoy.</div>';

    // Lista de cierres
    document.getElementById('cierres-lista').innerHTML = data.cierresCaja ? data.cierresCaja.slice(0, 5).map(c => `
        <div class="card">
            <div class="card-header"><span class="card-title">🔒 Cierre ${c.fecha}</span></div>
            <div class="kpi-grid">
                <div class="kpi-item"><span>Ventas Sistema</span><span>$${c.ventasSistema.toLocaleString()}</span></div>
                <div class="kpi-item"><span>Caja Real</span><span>$${c.cajaReal.toLocaleString()}</span></div>
                <div class="kpi-item"><span>Diferencia</span><span style="color:${c.diferencia === 0 ? 'var(--success)' : 'var(--danger)'}">$${c.diferencia.toLocaleString()}</span></div>
            </div>
        </div>
    `).join('') : '<div class="card">Sin cierres previos.</div>';
}

function renderStats() {
    const totalB2B = data.ventas ? data.ventas.filter(v => v.tipo === 'b2b').reduce((s, v) => s + v.monto, 0) : 0;
    const totalB2P = data.ventas ? data.ventas.filter(v => v.tipo === 'b2p').reduce((s, v) => s + v.monto, 0) : 0;
    const totalKg = data.ventas ? data.ventas.reduce((s, v) => s + (v.kg || 0), 0) : 0;
    const tareasComp = data.tareas ? data.tareas.filter(t => t.completado).length : 0;

    document.getElementById('stats').innerHTML = `
        <div class="stat-card"><div class="stat-value">$${(totalB2B / 1000).toFixed(0)}k</div><div class="stat-label">Ventas B2B</div></div>
        <div class="stat-card"><div class="stat-value">$${(totalB2P / 1000).toFixed(0)}k</div><div class="stat-label">Ventas B2P</div></div>
        <div class="stat-card"><div class="stat-value">${totalKg.toFixed(1)}</div><div class="stat-label">Kg Vendidos</div></div>
        <div class="stat-card"><div class="stat-value">${tareasComp}/${data.tareas?.length || 0}</div><div class="stat-label">Tareas</div></div>
        <div class="stat-card"><div class="stat-value">${data.clientes?.filter(c => c.estado === 'activo').length || 0}</div><div class="stat-label">Clientes Activos</div></div>
    `;
}

function renderMetasProgress() {
    if (!data.metas) return;
    const el = document.getElementById('metas-progress');
    if (!el) return; // Silent fail if element missing

    const b2bProg = Math.min(100, (data.ventas?.filter(v => v.tipo === 'b2b').reduce((s, v) => s + v.kg, 0) / data.metas.b2b.meta) * 100 || 0);
    const b2pProg = Math.min(100, (data.ventas?.filter(v => v.tipo === 'b2p').reduce((s, v) => s + v.monto, 0) / data.metas.b2p.meta) * 100 || 0);

    el.innerHTML = `
        <div class="card">
            <div style="display:flex;justify-content:space-between"><span>B2B</span><span>${data.metas.b2b.meta} ${data.metas.b2b.unidad}</span></div>
            <div class="progress-bar"><div class="progress-fill" style="width:${b2bProg}%">${b2bProg.toFixed(0)}%</div></div>
        </div>
        <div class="card" style="margin-top:0.75rem">
            <div style="display:flex;justify-content:space-between"><span>B2P</span><span>$${(data.metas.b2p.meta / 1000000).toFixed(1)}M</span></div>
            <div class="progress-bar"><div class="progress-fill" style="width:${b2pProg}%">${b2pProg.toFixed(0)}%</div></div>
        </div>
    `;
}

function renderMetasOverview() {
    if (!data.metas) return;
    const el = document.getElementById('metas-overview');
    if (!el) return;

    // Calcular métricas del MES ACTUAL
    const hoy = new Date();
    const mesActual = hoy.toISOString().substring(0, 7); // YYYY-MM

    // Ventas del mes (B2B + Web + Local)
    const ventasMes = (data.ventas || []).filter(v => v.fecha.startsWith(mesActual));
    const ventasWebMes = (data.ventasWeb || []).filter(v => v.fecha.startsWith(mesActual));
    const ventasLocalMes = (data.ventasLocales || []).filter(v => v.fecha.startsWith(mesActual));

    // Kg B2B (solo ventas B2B tienen Kg relevante)
    const actualKg = ventasMes.reduce((s, v) => s + (v.kg || 0), 0);

    // Ingresos Totales (Meta Financiera)
    const ingresoB2B = ventasMes.filter(v => v.pagado).reduce((s, v) => s + v.monto, 0);
    const ingresoWeb = ventasWebMes.reduce((s, v) => s + v.monto, 0);
    const ingresoLocal = ventasLocalMes.reduce((s, v) => s + v.monto, 0);
    const actualMonto = ingresoB2B + ingresoWeb + ingresoLocal;

    // Metas fijas (pueden venir de config o data.json)
    const metaKg = 300; // 300 Kg/mes
    const metaMonto = 3000000; // $3.000.000/mes (proyectado a 10k/kg aprox)

    el.innerHTML = `
        <div class="cards-grid">
            <div class="card">
                <div class="card-header">
                    <span class="card-title">🎯 Meta B2B (${mesActual})</span>
                    <span class="badge badge-b2b">Kg</span>
                </div>
                <div style="font-size:2rem;font-weight:700;color:var(--accent)">
                    ${actualKg.toFixed(1)} <span style="font-size:1rem;color:var(--text-secondary)">/ ${metaKg} kg</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${Math.min(100, actualKg / metaKg * 100)}%">
                        ${Math.round(actualKg / metaKg * 100)}%
                    </div>
                </div>
                <div class="card-detail" style="margin-top:0.5rem">🛒 Promedio diario: ${(actualKg / hoy.getDate()).toFixed(1)} kg</div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <span class="card-title">💰 Meta Financiera (${mesActual})</span>
                    <span class="badge badge-success">CLP</span>
                </div>
                <div style="font-size:2rem;font-weight:700;color:var(--success)">
                    $${(actualMonto / 1000).toFixed(0)}k <span style="font-size:1rem;color:var(--text-secondary)">/ $${(metaMonto / 1000).toFixed(0)}k</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${Math.min(100, actualMonto / metaMonto * 100)}%; background:var(--success)">
                        ${Math.round(actualMonto / metaMonto * 100)}%
                    </div>
                </div>
                 <div class="card-detail" style="margin-top:0.5rem">💵 Falta: $${Math.max(0, metaMonto - actualMonto).toLocaleString()}</div>
            </div>
        </div>
    `;
}

function renderEstadoResultados() {
    // Generar reporte dinámico desde Feb 2026
    const reporte = [];
    const fechaInicio = new Date('2026-02-01');
    const hoy = new Date();
    let iterador = new Date(fechaInicio);

    while (iterador <= hoy) {
        const mesStr = iterador.toISOString().substring(0, 7); // YYYY-MM

        // Calcular Ingresos
        const ingB2B = (data.ventas || []).filter(v => v.pagado && v.fecha.startsWith(mesStr)).reduce((s, v) => s + v.monto, 0);
        const ingWeb = (data.ventasWeb || []).filter(v => v.fecha.startsWith(mesStr)).reduce((s, v) => s + v.monto, 0);
        const ingLocal = (data.ventasLocales || []).filter(v => v.fecha.startsWith(mesStr)).reduce((s, v) => s + v.monto, 0);
        const totalIngresos = ingB2B + ingWeb + ingLocal;

        // Calcular Egresos
        const totalGastos = (data.gastos || []).filter(g => g.fecha.startsWith(mesStr)).reduce((s, g) => s + g.monto, 0);

        // Calcular Utilidad
        const utilidad = totalIngresos - totalGastos;

        reporte.unshift({ // Más recientes primero
            mes: mesStr,
            ingresos: totalIngresos,
            gastos: totalGastos,
            utilidad: utilidad
        });

        // Avanzar mes
        iterador.setMonth(iterador.getMonth() + 1);
    }

    const el = document.getElementById('estado-resultados');
    if (el) {
        el.innerHTML = `
            <div class="cards-grid">
                ${reporte.map(m => `
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">📅 ${m.mes}</span>
                            <span class="badge badge-${m.utilidad >= 0 ? 'activo' : 'perdido'}">${m.utilidad >= 0 ? 'Ganancia' : 'Pérdida'}</span>
                        </div>
                        <div class="kpi-grid">
                            <div class="kpi-item">
                                <span class="kpi-label">Ingresos</span>
                                <span class="kpi-value" style="color:var(--success)">$${m.ingresos.toLocaleString()}</span>
                            </div>
                            <div class="kpi-item">
                                <span class="kpi-label">Gastos</span>
                                <span class="kpi-value" style="color:var(--danger)">$${m.gastos.toLocaleString()}</span>
                            </div>
                            <div class="kpi-item" style="border-top:1px solid var(--border);padding-top:0.5rem;margin-top:0.25rem">
                                <span class="kpi-label" style="font-weight:700">Utilidad</span>
                                <span class="kpi-value" style="color:${m.utilidad >= 0 ? 'var(--success)' : 'var(--danger)'};font-size:1.1rem">$${m.utilidad.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

// Estado de meses expandidos
let mesesExpandidos = {};

function renderVentas() {
    if (!data.ventas) return;
    const el = document.getElementById('ventas-grid');
    if (!el) return;

    const estadoEmojis = { iniciada: '📝', proceso: '🔄', entregada: '✅' };
    const estadoColores = { iniciada: 'iniciada', proceso: 'proceso', entregada: 'entregada' };

    // Aplicar filtro
    let ventasFiltradas = [...data.ventas];
    if (ventasFilter === 'pendientes') {
        ventasFiltradas = ventasFiltradas.filter(v => !v.pagado);
    } else if (ventasFilter === 'pagadas') {
        ventasFiltradas = ventasFiltradas.filter(v => v.pagado);
    } else if (ventasFilter === 'sin-factura') {
        ventasFiltradas = ventasFiltradas.filter(v => !v.facturado);
    }

    // Filtro por cliente (buscador)
    const searchVal = document.getElementById('venta-client-search')?.value.toLowerCase();
    if (searchVal) {
        ventasFiltradas = ventasFiltradas.filter(v => v.cliente.toLowerCase().includes(searchVal));
    }

    // Ordenar por fecha (más recientes primero)
    ventasFiltradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    // Agrupar por mes para mejor organización
    const porMes = {};
    ventasFiltradas.forEach(v => {
        const mes = v.fecha?.substring(0, 7) || 'Sin fecha';
        if (!porMes[mes]) porMes[mes] = [];
        porMes[mes].push(v);
    });

    // Inicializar meses expandidos (el más reciente abierto por defecto)
    const meses = Object.keys(porMes);
    if (meses.length > 0 && Object.keys(mesesExpandidos).length === 0) {
        mesesExpandidos[meses[0]] = true; // Expandir mes más reciente
    }

    let html = '';
    Object.entries(porMes).forEach(([mes, ventas]) => {
        const mesTotal = ventas.reduce((s, v) => s + v.monto, 0);
        const mesKg = ventas.reduce((s, v) => s + (v.kg || 0), 0);
        const mesPendiente = ventas.filter(v => !v.pagado).reduce((s, v) => s + v.monto, 0);
        const isExpanded = mesesExpandidos[mes] ?? false;

        // Formatear mes para mostrar nombre
        const [year, month] = mes.split('-');
        const mesesNombres = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const mesNombre = mesesNombres[parseInt(month)] || mes;

        html += `<div class="card mes-header" style="grid-column:1/-1;background:var(--bg-secondary);cursor:pointer" onclick="toggleMes('${mes}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:1rem;font-weight:600;display:flex;align-items:center;gap:0.5rem">
                    <span style="transition:transform 0.2s;display:inline-block;transform:rotate(${isExpanded ? '90deg' : '0deg'})">&gt;</span>
                    📅 ${mesNombre} ${year}
                </span>
                <span style="color:var(--text-secondary);font-size:0.85rem">
                    ${ventas.length} ventas • ${mesKg.toFixed(0)}kg • $${(mesTotal / 1000).toFixed(0)}k
                    ${mesPendiente > 0 ? `<span style="color:var(--danger);margin-left:0.5rem">💵 $${(mesPendiente / 1000).toFixed(0)}k pend.</span>` : ''}
                </span>
            </div>
        </div>`;

        if (isExpanded) {
            ventas.forEach(v => {
                const estado = v.estado || 'iniciada';
                // Mostrar líneas de producto si existen
                let productosHtml = '';
                if (v.productos && v.productos.length > 0) {
                    productosHtml = `<div style="margin:0.5rem 0;padding:0.5rem;background:var(--bg-secondary);border-radius:6px">
                        ${v.productos.map(p => `<div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:0.25rem 0;border-bottom:1px solid var(--border)">
                            <span>☕ ${p.origen} (${p.formato})</span>
                            <span>${p.kg}kg • $${p.precio?.toLocaleString() || 0}</span>
                        </div>`).join('')}
                    </div>`;
                }
                html += `
                    <div class="card" style="border-left:4px solid ${estado === 'entregada' ? 'var(--success)' : estado === 'proceso' ? '#3b82f6' : 'var(--text-secondary)'}">
                        <div class="card-header">
                            <span class="card-title">${v.cliente}</span>
                            <div style="display:flex;gap:0.5rem;align-items:center">
                                <button onclick="editVenta(${v.id})" style="background:var(--bg-secondary);border:none;padding:0.25rem 0.5rem;border-radius:4px;cursor:pointer;font-size:0.75rem" title="Editar venta">✏️</button>
                                <button onclick="generarCotizacion(${v.id})" style="background:var(--success);color:white;border:none;padding:0.25rem 0.5rem;border-radius:4px;cursor:pointer;font-size:0.75rem" title="Generar cotización">💬</button>
                                <span style="font-size:0.75rem;color:var(--text-secondary)">#${v.id}</span>
                            </div>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin:0.5rem 0">
                            <span style="font-size:1.25rem;font-weight:700;color:var(--accent)">$${v.monto.toLocaleString()}</span>
                            <span class="badge badge-${v.tipo}">${v.tipo.toUpperCase()}</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.75rem">
                            <span>📅 ${v.fecha}</span>
                            <span>⚖️ ${v.kg}kg</span>
                            <span>☕ ${v.origen}</span>
                        </div>
                        ${productosHtml}
                        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                            <span class="badge badge-${estadoColores[estado]}" onclick="cycleVentaEstado(${v.id})" style="cursor:pointer" title="Click para cambiar">
                                ${estadoEmojis[estado]} ${estado.charAt(0).toUpperCase() + estado.slice(1)}
                            </span>
                            <span class="badge ${v.facturado ? 'badge-activo' : 'badge-perdido'}" onclick="toggleVentaFacturado(${v.id})" style="cursor:pointer">
                                ${v.facturado ? '📄 Facturado' : '📄 Sin factura'}
                            </span>
                            <span class="badge ${v.pagado ? 'badge-activo' : 'badge-alta'}" onclick="toggleVentaPagado(${v.id})" style="cursor:pointer">
                                ${v.pagado ? '💵 Pagado' : '💵 Pendiente'}
                            </span>
                        </div>
                        ${v.notas ? `<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--text-secondary)">${v.notas}</div>` : ''}
                    </div>
                `;
            });
        }
    });

    el.innerHTML = html || '<div class="card">No hay ventas con este filtro</div>';
}

function toggleMes(mes) {
    mesesExpandidos[mes] = !mesesExpandidos[mes];
    renderVentas();
}

function cycleVentaEstado(id) {
    const v = data.ventas.find(x => x.id === id);
    if (!v) return;
    const orden = ['iniciada', 'proceso', 'entregada'];
    v.estado = orden[(orden.indexOf(v.estado || 'iniciada') + 1) % 3];
    saveData();
    renderVentas();
}

function toggleVentaFacturado(id) {
    const v = data.ventas.find(x => x.id === id);
    if (!v) return;
    v.facturado = !v.facturado;
    saveData();
    renderVentas();
}

function toggleVentaPagado(id) {
    const v = data.ventas.find(x => x.id === id);
    if (!v) return;
    v.pagado = !v.pagado;
    saveData();
    renderVentas();
}

function renderAgentes() {
    if (!data.agentes) return;
    const el = document.getElementById('agentes-grid');
    if (!el) return;

    el.innerHTML = data.agentes.map(a => `
        <div class="card">
            <div class="card-header">
                <span class="card-title">${a.emoji} ${a.nombre}</span>
            </div>
            <div class="kpi-grid">
                ${a.kpis.map(k => `
                    <div class="kpi-item">
                        <span class="kpi-label">${k.nombre}</span>
                        <span class="kpi-value">${k.actual}/${k.meta}${k.unidad}</span>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.5rem">TAREAS SEMANA</div>
                ${a.tareasSemana.slice(0, 3).map(t => `<div class="card-detail" style="margin:0.25rem 0">• ${t}</div>`).join('')}
            </div>
        </div>
    `).join('');
}

function renderPlanes() {
    if (!data.planesAccion) return;
    document.getElementById('planes-grid').innerHTML = data.planesAccion.map(p => `
        <div class="card">
            <div class="card-header">
                <span class="card-title">${p.fase}</span>
                <span class="badge badge-${p.estado === 'activo' ? 'activo' : 'idea'}">${p.estado}</span>
            </div>
            <div class="plan-actions">
                ${p.acciones.map((a, i) => `
                    <div class="plan-action ${a.completado ? 'completed' : ''}" onclick="togglePlanAction(${p.id}, ${i})">
                        ${a.completado ? '✅' : '⬜'} ${a.accion}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function togglePlanAction(planId, actionIdx) {
    const plan = data.planesAccion.find(p => p.id === planId);
    if (plan) {
        plan.acciones[actionIdx].completado = !plan.acciones[actionIdx].completado;
        saveData();
        renderPlanes();
    }
}

function renderClientes() {
    if (!data.clientes) return;
    document.getElementById('clientes-grid').innerHTML = data.clientes.map(c => `
        <div class="card">
            <div class="card-header">
                <span class="card-title">${c.nombre}</span>
                <span class="badge badge-${c.estado}">${c.estado}</span>
            </div>
            <div class="card-meta">
                ${c.ciudad ? `<span class="card-detail">📍 ${c.ciudad}</span>` : ''}
                ${c.kgPromedio ? `<span class="card-detail">⚖️ ${c.kgPromedio}kg/pedido</span>` : ''}
            </div>
            ${c.notas ? `<div class="card-detail" style="margin-top:0.5rem">${c.notas}</div>` : ''}
            <div class="card-actions">
                <button class="card-btn" onclick="editCliente(${c.id})">✏️ Editar</button>
                <button class="card-btn primary" onclick="contactCliente('${c.nombre}')">💬 Contactar</button>
            </div>
        </div>
    `).join('') || '<div class="card">Aún no hay clientes</div>';
}

function renderCalendario() {
    if (!data.calendario) return;
    const estados = ['idea', 'produccion', 'publicado'];
    document.getElementById('calendario-grid').innerHTML = data.calendario.map(p => `
        <div class="card">
            <div class="card-header">
                <span class="card-title">${p.titulo}</span>
                <span class="badge badge-${p.estado}" onclick="cyclePostStatus(${p.id})" style="cursor:pointer">${p.estado}</span>
            </div>
            <div class="card-meta">
                <span class="badge badge-${p.pilar}">${p.pilar}</span>
                <span class="card-detail">📅 ${p.fecha}</span>
                <span class="card-detail">📱 ${p.formato}</span>
            </div>
            ${p.copy ? `<div class="card-detail" style="margin-top:0.5rem">${p.copy}</div>` : ''}
        </div>
    `).join('');
}

function cyclePostStatus(id) {
    const p = data.calendario.find(x => x.id === id);
    if (!p) return;
    const orden = ['idea', 'produccion', 'publicado'];
    p.estado = orden[(orden.indexOf(p.estado) + 1) % 3];
    saveData();
    renderCalendario();
}

function renderTareas() {
    if (!data.tareas) return;
    document.getElementById('tareas-grid').innerHTML = data.tareas.map(t => `
        <div class="card tarea-card">
            <div class="tarea-checkbox ${t.completado ? 'checked' : ''}" onclick="toggleTarea(${t.id})"></div>
            <div class="tarea-content ${t.completado ? 'completed' : ''}">
                <div class="card-title">${t.tarea}</div>
                <div class="card-meta">
                    <span class="badge badge-${t.prioridad}">${t.prioridad}</span>
                    ${t.responsable ? `<span class="card-detail">👤 ${t.responsable}</span>` : ''}
                    <span class="card-detail">📅 ${t.fechaLimite}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function toggleTarea(id) {
    const t = data.tareas.find(x => x.id === id);
    if (t) {
        t.completado = !t.completado;
        saveData();
        renderTareas();
        renderStats();
        renderUrgentTasks();
    }
}

function renderInventario() {
    if (!data.inventario) return;
    document.getElementById('inventario-grid').innerHTML = data.inventario.map(i => `
        <div class="card" style="border-left: 3px solid ${i.stockActual <= i.puntoReorden ? 'var(--danger)' : 'var(--success)'}">
            <div class="card-header">
                <span class="card-title">${i.origen}</span>
                ${i.stockActual <= i.puntoReorden ? '<span class="badge badge-alta">⚠️ Bajo</span>' : ''}
            </div>
            <div style="font-size:1.5rem;font-weight:700">${i.stockActual} <span style="font-size:0.875rem;color:var(--text-secondary)">kg</span></div>
            <div class="card-detail">Punto reorden: ${i.puntoReorden}kg</div>
        </div>
    `).join('');
}

function renderUrgentTasks() {
    if (!data.tareas) return;
    const urgent = data.tareas.filter(t => !t.completado && t.prioridad === 'alta').slice(0, 3);
    document.getElementById('urgent-tasks').innerHTML = urgent.length ? urgent.map(t => `
        <div class="card" style="border-left:3px solid var(--danger)">
            <div class="card-title">${t.tarea}</div>
            <div class="card-detail">📅 ${t.fechaLimite}</div>
        </div>
    `).join('') : '<div class="card">No hay tareas urgentes 🎉</div>';
}

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(btn.dataset.section).classList.add('active');
    });
});

// Modal
let currentModal = null;
let editingId = null;

function openModal(type, id = null) {
    currentModal = type;
    editingId = id;
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('modal-title').textContent = id ? 'Editar' : 'Agregar';
    renderModalBody(type, id);
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    currentModal = null;
    editingId = null;
}

function renderModalBody(type, id) {
    let html = '';
    if (type === 'create_user') {
        html = `
            <div class="form-group">
                <label class="form-label">Nombre de Usuario</label>
                <input type="text" id="new-user-name" class="form-input" placeholder="ej. demo">
            </div>
            <div class="form-group">
                <label class="form-label">Contraseña</label>
                <input type="text" id="new-user-pass" class="form-input" placeholder="ej. demo123">
            </div>
            <div class="form-group">
                <label class="form-label">Plan</label>
                <select id="new-user-plan" class="form-select">
                    <option value="free">Gratuito (Básico)</option>
                    <option value="pro">PRO ($13/mes)</option>
                </select>
            </div>
        `;
        // Bind save button
        setTimeout(() => {
            const btn = document.getElementById('modal-save');
            if (btn) btn.onclick = createUser;
        }, 100);
    } else if (type === 'venta') {
        const origenes = ['Brasil', 'Colombia', 'Peru', 'Bolivia', 'Costa Rica', 'Honduras', 'Etiopia', 'Robusta', 'Blend', 'Mix'];
        const formatos = ['1kg Grano', '1kg Molido', '500g Grano', '500g Molido', '250g Grano', '250g Molido', 'Granel'];

        // Si estamos editando, cargar datos existentes
        const venta = id ? data.ventas.find(v => v.id === id) : null;
        const productos = venta?.productos || [];

        html = `
            <div class="form-group"><label class="form-label">Cliente</label><input type="text" class="form-input" id="venta-cliente" value="${venta?.cliente || ''}"></div>
            <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="venta-tipo">
                <option value="b2b" ${venta?.tipo === 'b2b' ? 'selected' : ''}>B2B</option>
                <option value="b2p" ${venta?.tipo === 'b2p' ? 'selected' : ''}>B2P</option>
            </select></div>
            <div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" id="venta-fecha" value="${venta?.fecha || new Date().toISOString().split('T')[0]}"></div>
            
            <div style="background:var(--bg-secondary);padding:1rem;border-radius:8px;margin:1rem 0">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
                    <label class="form-label" style="margin:0">📦 Líneas de Producto</label>
                    <button type="button" onclick="agregarLineaProducto()" style="background:var(--accent);color:white;border:none;padding:0.5rem 1rem;border-radius:6px;cursor:pointer;font-size:0.85rem">+ Agregar Línea</button>
                </div>
                <div id="productos-container">
                    ${productos.length > 0 ? productos.map((p, i) => `
                        <div class="linea-producto" data-index="${i}" style="display:grid;grid-template-columns:2fr 1.5fr 1fr 1fr auto;gap:0.5rem;margin-bottom:0.5rem;align-items:center">
                            <select class="form-select producto-origen">
                                ${origenes.map(o => `<option value="${o}" ${p.origen === o ? 'selected' : ''}>${o}</option>`).join('')}
                            </select>
                            <select class="form-select producto-formato">
                                ${formatos.map(f => `<option value="${f}" ${p.formato === f ? 'selected' : ''}>${f}</option>`).join('')}
                            </select>
                            <input type="number" step="0.5" class="form-input producto-kg" placeholder="Kg" value="${p.kg || ''}" style="width:100%">
                            <input type="number" class="form-input producto-precio" placeholder="$ Neto/Kg" value="${p.precio || ''}" style="width:100%">
                            <button type="button" onclick="eliminarLineaProducto(this)" style="background:var(--danger);color:white;border:none;width:30px;height:30px;border-radius:4px;cursor:pointer">×</button>
                        </div>
                    `).join('') : ''}
                </div>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                <div class="form-group"><label class="form-label">Kg Total</label><input type="number" step="0.5" class="form-input" id="venta-kg" value="${venta?.kg || ''}" readonly></div>
                <div class="form-group"><label class="form-label">Monto Total (IVA Inc)</label><input type="number" class="form-input" id="venta-monto" value="${venta?.monto || ''}" readonly></div>
            </div>
            
            <div class="form-group"><label class="form-label">Origen Principal</label>
                <select class="form-select" id="venta-origen">
                    ${origenes.map(o => `<option value="${o}" ${venta?.origen === o ? 'selected' : ''}>${o}</option>`).join('')}
                </select>
            </div>
            
            <div class="form-group"><label class="form-label">Estado</label><select class="form-select" id="venta-estado">
                <option value="iniciada" ${venta?.estado === 'iniciada' ? 'selected' : ''}>📝 Iniciada</option>
                <option value="proceso" ${venta?.estado === 'proceso' ? 'selected' : ''}>🔄 En Proceso</option>
                <option value="entregada" ${venta?.estado === 'entregada' ? 'selected' : ''}>✅ Entregada</option>
            </select></div>
            
            <div class="form-group" style="display:flex;gap:1rem">
                <label style="display:flex;align-items:center;gap:0.5rem"><input type="checkbox" id="venta-facturado" ${venta?.facturado ? 'checked' : ''}> Facturado</label>
                <label style="display:flex;align-items:center;gap:0.5rem"><input type="checkbox" id="venta-pagado" ${venta?.pagado ? 'checked' : ''}> Pagado</label>
            </div>
            <div class="form-group"><label class="form-label">Notas</label><textarea class="form-textarea" id="venta-notas">${venta?.notas || ''}</textarea></div>
        `;
    } else if (type === 'cliente') {
        html = `
            <div class="form-group"><label class="form-label">Nombre</label><input type="text" class="form-input" id="cliente-nombre"></div>
            <div class="form-group"><label class="form-label">Estado</label><select class="form-select" id="cliente-estado"><option value="activo">Activo</option><option value="reactivar">Por Reactivar</option><option value="prospecto">Prospecto</option><option value="perdido">Perdido</option></select></div>
            <div class="form-group"><label class="form-label">Ciudad</label><input type="text" class="form-input" id="cliente-ciudad"></div>
            <div class="form-group"><label class="form-label">Kg Promedio/Pedido</label><input type="number" class="form-input" id="cliente-kg"></div>
            <div class="form-group"><label class="form-label">Notas</label><textarea class="form-textarea" id="cliente-notas"></textarea></div>
        `;
    } else if (type === 'post') {
        html = `
            <div class="form-group"><label class="form-label">Título</label><input type="text" class="form-input" id="post-titulo"></div>
            <div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" id="post-fecha"></div>
            <div class="form-group"><label class="form-label">Pilar</label><select class="form-select" id="post-pilar"><option value="educacion">Educación</option><option value="producto">Producto</option><option value="bts">BTS</option><option value="social">Social</option></select></div>
            <div class="form-group"><label class="form-label">Formato</label><select class="form-select" id="post-formato"><option value="reel">Reel</option><option value="carrusel">Carrusel</option><option value="post">Post</option><option value="story">Story</option></select></div>
            <div class="form-group"><label class="form-label">Copy</label><textarea class="form-textarea" id="post-copy"></textarea></div>
        `;
    } else if (type === 'tarea') {
        html = `
            <div class="form-group"><label class="form-label">Tarea</label><input type="text" class="form-input" id="tarea-desc"></div>
            <div class="form-group"><label class="form-label">Responsable</label><input type="text" class="form-input" id="tarea-resp"></div>
            <div class="form-group"><label class="form-label">Prioridad</label><select class="form-select" id="tarea-prio"><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></div>
            <div class="form-group"><label class="form-label">Área</label><select class="form-select" id="tarea-area"><option value="ventas">Ventas</option><option value="contenido">Contenido</option><option value="marketing">Marketing</option><option value="operaciones">Operaciones</option></select></div>
            <div class="form-group"><label class="form-label">Fecha Límite</label><input type="date" class="form-input" id="tarea-fecha"></div>
        `;
    } else if (type === 'inventario') {
        html = `
            <div class="form-group"><label class="form-label">Origen</label><input type="text" class="form-input" id="inv-origen"></div>
            <div class="form-group"><label class="form-label">Stock Actual (kg)</label><input type="number" class="form-input" id="inv-stock"></div>
            <div class="form-group"><label class="form-label">Punto Reorden (kg)</label><input type="number" class="form-input" id="inv-reorden"></div>
            <div class="form-group"><label class="form-label">Proveedor</label><input type="text" class="form-input" id="inv-prov"></div>
        `;
    } else if (type === 'gasto') {
        html = `
            <div class="form-group"><label class="form-label">Descripción</label><input type="text" class="form-input" id="gasto-desc" placeholder="Ej: Pago Arriendo"></div>
            <div class="form-group"><label class="form-label">Categoría</label>
                <select class="form-select" id="gasto-cat">
                    <option value="fijo">🏠 Gasto Fijo (Arriendo, Luz, Sueldos)</option>
                    <option value="variable">📉 Gasto Variable (Insumos, Reparaciones)</option>
                    <option value="materia_prima">☕ Materia Prima (Café Verde)</option>
                    <option value="logistica">🚚 Logística (Envíos)</option>
                    <option value="marketing">📣 Marketing</option>
                    <option value="otros">📋 Otros</option>
                </select>
            </div>
            <div class="form-group"><label class="form-label">Monto (CLP)</label><input type="number" class="form-input" id="gasto-monto"></div>
            <div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" id="gasto-fecha" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label class="form-label">Notas</label><textarea class="form-textarea" id="gasto-notas"></textarea></div>
        `;
    } else if (type === 'venta_local') {
        html = `
            <div class="form-group"><label class="form-label">Items / Pedido</label><input type="text" class="form-input" id="local-items" placeholder="Ej: 2 Latte + 1 Muffin"></div>
            <div class="form-group"><label class="form-label">Total Venta ($)</label><input type="number" class="form-input" id="local-monto"></div>
            <div class="form-group"><label class="form-label">Método de Pago</label>
                <select class="form-select" id="local-metodo">
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="tarjeta">💳 Tarjeta (Débito/Crédito)</option>
                    <option value="transferencia">📲 Transferencia</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label"><input type="checkbox" id="local-descontar-bolsa"> ¿Descontar Bolsa de Café (250g)?</label>
                <select class="form-select" id="local-origen-bolsa" style="margin-top:0.5rem">
                    <option value="Brasil">Brasil</option>
                    <option value="Colombia">Colombia</option>
                    <option value="Peru">Perú</option>
                </select>
            </div>
        `;
    } else if (type === 'cierre_caja') {
        const hoy = new Date().toISOString().split('T')[0];
        const ventasHoy = data.ventasLocales ? data.ventasLocales.filter(v => v.fecha === hoy) : [];
        const totalSistema = ventasHoy.reduce((s, v) => s + v.monto, 0);

        html = `
            <div class="card" style="margin-bottom:1rem; background:var(--bg-secondary)">
                <div style="font-size:0.875rem">Ventas en Sistema (Hoy):</div>
                <div style="font-size:1.5rem; font-weight:700; color:var(--success)">$${totalSistema.toLocaleString()}</div>
            </div>
            <div class="form-group"><label class="form-label">Efectivo Real en Caja</label><input type="number" class="form-input" id="cierre-real" placeholder="Cuenta el dinero físico"></div>
            <div class="form-group"><label class="form-label">Notas del Cierre</label><textarea class="form-textarea" id="cierre-notas" placeholder="Ej: Diferencia por sencillo..."></textarea></div>
            <input type="hidden" id="cierre-sistema" value="${totalSistema}">
        `;
    } else if (type === 'venta_web') {
        html = `
            <div class="form-group"><label class="form-label">Cliente / Nombre Pedido</label><input type="text" class="form-input" id="web-cliente" placeholder="Nombre del comprador"></div>
            <div class="form-group"><label class="form-label">Nº Pedido Shopify</label><input type="text" class="form-input" id="web-orden" placeholder="#1001"></div>
            <div class="form-group"><label class="form-label">Monto Total ($)</label><input type="number" class="form-input" id="web-monto"></div>
            <div class="form-group"><label class="form-label">Productos</label><input type="text" class="form-input" id="web-productos" placeholder="Ej: 2x Brasil 250g + 1x Colombia 1kg"></div>
            <div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" id="web-fecha" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label class="form-label">Estado</label>
                <select class="form-select" id="web-estado">
                    <option value="pagado">✅ Pagado</option>
                    <option value="pendiente">⏳ Pendiente envío</option>
                    <option value="enviado">📦 Enviado</option>
                    <option value="entregado">🏠 Entregado</option>
                </select>
            </div>
            <div class="form-group"><label class="form-label">Notas</label><textarea class="form-textarea" id="web-notas"></textarea></div>
        `;
    } else if (type === 'create_user') {
        html = `
            <div class="form-group"><label class="form-label">Nuevo Usuario (Email/Nombre)</label><input type="text" class="form-input" id="new-user-name"></div>
            <div class="form-group"><label class="form-label">Contraseña</label><input type="text" class="form-input" id="new-user-pass" value="123456"></div>
            <div class="form-group"><label class="form-label">Plan</label>
                <select class="form-select" id="new-user-plan">
                    <option value="free">Gratuito</option>
                    <option value="pro">PRO</option>
                </select>
            </div>
        `;
    }
    document.getElementById('modal-body').innerHTML = html;
}

document.getElementById('modal-save').addEventListener('click', async () => {
    // Helper to safely push and update local state
    const pushAndReload = async (arrayName, item) => {
        try {
            const updatedList = await api.push(arrayName, item);
            if (updatedList) {
                // Update local data with the server response (which is the full new list)
                data[arrayName] = updatedList;
                renderAll();
                showToast();
                closeModal();
            }
        } catch (e) {
            console.error(e);
            alert('Error guardando. Intenta de nuevo.');
        }
    };

    if (currentModal === 'create_user') {
        const username = document.getElementById('new-user-name').value;
        const password = document.getElementById('new-user-pass').value;
        const plan = document.getElementById('new-user-plan').value;

        if (!username || !password) return alert('Datos incompletos');

        try {
            const res = await api.post('/api/register', { username, password, plan });
            if (res.error) throw new Error(res.error);
            alert('✅ Usuario creado correctamente');
            closeModal();
            if (typeof renderSubscribers === 'function') renderSubscribers();
        } catch (e) {
            alert('❌ Error: ' + e.message);
        }
    } else if (currentModal === 'venta') {
        const lineas = document.querySelectorAll('.linea-producto');
        const productos = Array.from(lineas).map(linea => ({
            origen: linea.querySelector('.producto-origen').value,
            formato: linea.querySelector('.producto-formato').value,
            kg: parseFloat(linea.querySelector('.producto-kg').value) || 0,
            precio: parseInt(linea.querySelector('.producto-precio').value) || 0
        })).filter(p => p.kg > 0);

        const ventaData = {
            cliente: document.getElementById('venta-cliente').value,
            tipo: document.getElementById('venta-tipo').value,
            monto: parseInt(document.getElementById('venta-monto').value) || 0,
            kg: parseFloat(document.getElementById('venta-kg').value) || 0,
            origen: document.getElementById('venta-origen').value,
            fecha: document.getElementById('venta-fecha').value || new Date().toISOString().split('T')[0],
            estado: document.getElementById('venta-estado').value,
            facturado: document.getElementById('venta-facturado').checked,
            pagado: document.getElementById('venta-pagado').checked,
            notas: document.getElementById('venta-notas').value,
            productos: productos
        };

        if (editingId) {
            // EDIT: Use legacy full save
            const index = data.ventas.findIndex(v => v.id === editingId);
            if (index !== -1) {
                data.ventas[index] = { ...data.ventas[index], ...ventaData };
                saveData(); // Legacy save
                closeModal();
                renderAll();
            }
        } else {
            // NEW: Use Atomic Push
            ventaData.id = Date.now();
            await pushAndReload('ventas', ventaData);

            // Side Effects (Inventory) - This still needs to be saved manually or pushed?
            // Inventory is complex. For now let's keep it as legacy save since it modifies existing items.
            // Ideally we should have an inventory transaction endpoint.
            if (productos.length > 0) {
                descontarInventario(productos);
                saveData(); // This might race, but less critical than sales loss.
            }
        }
    } else if (currentModal === 'cliente') {
        const newCliente = {
            id: Date.now(),
            nombre: document.getElementById('cliente-nombre').value,
            estado: document.getElementById('cliente-estado').value,
            ciudad: document.getElementById('cliente-ciudad').value,
            kgPromedio: parseInt(document.getElementById('cliente-kg').value) || 0,
            notas: document.getElementById('cliente-notas').value
        };
        if (editingId) {
            // Edit logic... (omitted for brevity, assume similar to original if needed or just use Push for new)
            const index = data.clientes.findIndex(c => c.id === editingId);
            if (index !== -1) { data.clientes[index] = newCliente; saveData(); closeModal(); renderAll(); }
        } else {
            await pushAndReload('clientes', newCliente);
        }
    } else if (currentModal === 'post') {
        const newPost = {
            id: Date.now(),
            titulo: document.getElementById('post-titulo').value,
            fecha: document.getElementById('post-fecha').value,
            pilar: document.getElementById('post-pilar').value,
            formato: document.getElementById('post-formato').value,
            estado: 'idea',
            copy: document.getElementById('post-copy').value
        };
        await pushAndReload('calendario', newPost);
    } else if (currentModal === 'tarea') {
        const newTarea = {
            id: Date.now(),
            tarea: document.getElementById('tarea-desc').value,
            responsable: document.getElementById('tarea-resp').value,
            prioridad: document.getElementById('tarea-prio').value,
            area: document.getElementById('tarea-area').value,
            fechaLimite: document.getElementById('tarea-fecha').value,
            completado: false
        };
        await pushAndReload('tareas', newTarea);
    } else if (currentModal === 'inventario') {
        const newInv = {
            id: Date.now(),
            origen: document.getElementById('inv-origen').value,
            stockActual: parseInt(document.getElementById('inv-stock').value) || 0,
            puntoReorden: parseInt(document.getElementById('inv-reorden').value) || 10,
            proveedor: document.getElementById('inv-prov').value
        };
        await pushAndReload('inventario', newInv);
    } else if (currentModal === 'gasto') {
        const newGasto = {
            id: Date.now(),
            descripcion: document.getElementById('gasto-desc').value,
            categoria: document.getElementById('gasto-cat').value,
            monto: parseInt(document.getElementById('gasto-monto').value) || 0,
            fecha: document.getElementById('gasto-fecha').value || new Date().toISOString().split('T')[0],
            notas: document.getElementById('gasto-notas').value
        };
        await pushAndReload('gastos', newGasto);
    } else if (currentModal === 'venta_local') {
        const ventaLocal = {
            id: Date.now(),
            items: document.getElementById('local-items').value,
            monto: parseInt(document.getElementById('local-monto').value) || 0,
            metodo: document.getElementById('local-metodo').value,
            fecha: new Date().toISOString().split('T')[0],
            hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        let deduct = [];
        if (document.getElementById('local-descontar-bolsa').checked) {
            const origen = document.getElementById('local-origen-bolsa').value;
            deduct.push({ origen: origen, kg: 0.25 });
        }

        try {
            // Atomic update via new endpoint
            const res = await api.post('/api/sales/local', {
                sale: ventaLocal,
                deductInventory: deduct
            });

            if (res && res.sales) {
                data.ventasLocales = res.sales;
                if (res.inventory) data.inventario = res.inventory;
                renderAll();
                showToast();
                closeModal();
            }
        } catch (e) {
            alert('Error guardando venta local');
        }
    } else if (currentModal === 'cierre_caja') {
        const real = parseInt(document.getElementById('cierre-real').value) || 0;
        const sistema = parseInt(document.getElementById('cierre-sistema').value) || 0;
        const cierre = {
            id: Date.now(),
            fecha: new Date().toISOString().split('T')[0],
            ventasSistema: sistema,
            cajaReal: real,
            diferencia: real - sistema,
            notas: document.getElementById('cierre-notas').value
        };
        await pushAndReload('cierresCaja', cierre);
    } else if (currentModal === 'venta_web') {
        const ventaWeb = {
            id: Date.now(),
            cliente: document.getElementById('web-cliente').value,
            orden: document.getElementById('web-orden').value,
            monto: parseInt(document.getElementById('web-monto').value) || 0,
            productos: document.getElementById('web-productos').value,
            fecha: document.getElementById('web-fecha').value || new Date().toISOString().split('T')[0],
            estado: document.getElementById('web-estado').value,
            canal: 'web',
            notas: document.getElementById('web-notas').value
        };
        await pushAndReload('ventasWeb', ventaWeb);
    }
});

function editCliente(id) { openModal('cliente', id); }
function editVenta(id) { openModal('venta', id); }
function contactCliente(nombre) { window.open(`https://wa.me/?text=Hola ${encodeURIComponent(nombre)}, te escribo de Candela Coffee...`); }

function marcarPagado(id) {
    const venta = data.ventas.find(v => v.id === id);
    if (venta) {
        venta.pagado = true;
        saveData();
        renderAll();
        showToast('✅ Venta marcada como pagada');
    }
}

async function renderSuscriptores() {
    console.log('👥 Rendering Suscriptores...');
    const container = document.getElementById('suscriptores-list');
    if (!container) return;

    try {
        const res = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
            const users = await res.json();
            container.innerHTML = users.map(u => `
                <div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
                    <div>
                        <strong>${u.username}</strong>
                        <span class="badge ${u.plan === 'pro' ? 'badge-success' : 'badge-warning'}">${u.plan}</span>
                        <div style="font-size:0.8rem;color:var(--text-secondary)">ID: ${u.id} | Creado: ${new Date(u.created_at).toLocaleDateString()}</div>
                    </div>
                </div>
            `).join('');
        } else {
            console.error('Error fetching users:', await res.text());
        }
    } catch (e) { console.error('Error rendering subs:', e); }
}

function marcarFacturado(id) {
    const venta = data.ventas.find(v => v.id === id);
    if (venta) {
        venta.facturado = true;
        saveData();
        renderAll();
        showToast('📄 Venta marcada como facturada');
    }
}
function descontarInventario(productosVendidos) {
    if (!data.inventario) return;
    productosVendidos.forEach(p => {
        // Buscamos el origen en el inventario
        const itemInv = data.inventario.find(i => i.origen.toLowerCase() === p.origen.toLowerCase());
        if (itemInv) {
            itemInv.stockActual = Math.max(0, itemInv.stockActual - p.kg);
        }
    });
}

function generarCotizacion(id) {
    const v = data.ventas.find(x => x.id === id);
    if (!v) return;

    let mensaje = `*COTIZACIÓN CANDELA COFFEE*\n`;
    mensaje += `--------------------------\n`;
    mensaje += `*Cliente:* ${v.cliente}\n`;
    mensaje += `*Fecha:* ${v.fecha}\n\n`;
    mensaje += `*PRODUCTOS:*\n`;

    v.productos.forEach(p => {
        const neto = p.precio * p.kg;
        mensaje += `• ${p.origen} (${p.formato})\n`;
        mensaje += `  ${p.kg}kg x $${p.precio.toLocaleString()} = $${neto.toLocaleString()} (Neto)\n`;
    });

    const iva = v.monto - (v.monto / 1.19);
    mensaje += `\n--------------------------\n`;
    mensaje += `*Neto:* $${Math.round(v.monto / 1.19).toLocaleString()}\n`;
    mensaje += `*IVA (19%):* $${Math.round(iva).toLocaleString()}\n`;
    mensaje += `*TOTAL (IVA Inc):* $${v.monto.toLocaleString()}\n\n`;
    mensaje += `_Maestría en fuego · Chillán_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`);
}

// Funciones para líneas de producto en modal de venta
function agregarLineaProducto() {
    const origenes = ['Brasil', 'Colombia', 'Peru', 'Bolivia', 'Costa Rica', 'Honduras', 'Etiopia', 'Robusta', 'Blend', 'Mix'];
    const formatos = ['1kg Grano', '1kg Molido', '500g Grano', '500g Molido', '250g Grano', '250g Molido', 'Granel'];
    const container = document.getElementById('productos-container');
    const index = container.children.length;
    const div = document.createElement('div');
    div.className = 'linea-producto';
    div.dataset.index = index;
    div.style.cssText = 'display:grid;grid-template-columns:2fr 1.5fr 1fr 1fr auto;gap:0.5rem;margin-bottom:0.5rem;align-items:center';
    div.innerHTML = `
        <select class="form-select producto-origen">
            ${origenes.map(o => `<option value="${o}">${o}</option>`).join('')}
        </select>
        <select class="form-select producto-formato">
            ${formatos.map(f => `<option value="${f}">${f}</option>`).join('')}
        </select>
        <input type="number" step="0.5" class="form-input producto-kg" placeholder="Kg" style="width:100%">
        <input type="number" class="form-input producto-precio" placeholder="$ Neto/Kg" style="width:100%">
        <button type="button" onclick="eliminarLineaProducto(this)" style="background:var(--danger);color:white;border:none;width:30px;height:30px;border-radius:4px;cursor:pointer">×</button>
    `;
    container.appendChild(div);

    // Agregar listeners para calcular totales automáticamente
    div.querySelectorAll('.producto-kg, .producto-precio').forEach(input => {
        input.addEventListener('input', calcularTotalesVenta);
    });
}

function eliminarLineaProducto(btn) {
    btn.closest('.linea-producto').remove();
    calcularTotalesVenta();
}

function calcularTotalesVenta() {
    const lineas = document.querySelectorAll('.linea-producto');
    let totalKg = 0;
    let totalMonto = 0;
    lineas.forEach(linea => {
        const kg = parseFloat(linea.querySelector('.producto-kg').value) || 0;
        const precioUnitario = parseInt(linea.querySelector('.producto-precio').value) || 0;

        totalKg += kg;
        // Cálculo: (Precio Unitario * Kg) + 19% IVA
        const neto = kg * precioUnitario;
        const totalLinea = neto * 1.19;

        totalMonto += totalLinea;
    });
    document.getElementById('venta-kg').value = totalKg;


    document.getElementById('venta-monto').value = Math.round(totalMonto);
}

async function renderSubscribers() {
    if (currentUser.username !== 'admin') return;
    try {
        const users = await api.get('/api/admin/users');
        const tbody = document.getElementById('subscribers-table');

        // Stats
        const total = users.length;
        const pros = users.filter(u => u.plan === 'pro').length;
        const mrr = pros * 13; // $13 USD

        document.getElementById('subscribers-table').innerHTML = users.map(u => {
            const isPro = u.plan === 'pro';
            const expires = u.plan_expires ? new Date(u.plan_expires).toLocaleDateString() : '-';
            return `
                <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:1rem">
                        <div style="font-weight:bold">${u.username}</div>
                        <div style="font-size:0.8rem;color:var(--text-secondary)">ID: ${u.id}</div>
                    </td>
                    <td style="padding:1rem">
                        <span class="badge ${isPro ? 'badge-activo' : 'badge-idea'}">${u.plan || 'free'}</span>
                    </td>
                    <td style="padding:1rem">
                        <span style="color:${isPro ? 'var(--success)' : 'var(--text-secondary)'}">● ${isPro ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    <td style="padding:1rem">${expires}</td>
                    <td style="padding:1rem">
                        <button class="btn btn-secondary" style="font-size:0.8rem" onclick="alert('Funcionalidad en desarrollo')">Gestionar</button>
                    </td>
                </tr>
            `;
        }).join('');

        document.getElementById('sub-total').textContent = total;
        document.getElementById('sub-pro').textContent = pros;
        document.getElementById('sub-mrr').textContent = `$${mrr} USD`;

    } catch (e) {
        console.error(e);
        document.getElementById('subscribers-table').innerHTML = '<tr><td colspan="5" style="padding:1rem;text-align:center">Error cargando usuarios</td></tr>';
    }
}

// Hook into navigation to load subscribers
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.section === 'suscriptores') {
            renderSubscribers();
        }
    });
});

// Init
checkAuth();
