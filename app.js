// Candela CRM App
let data = {};
let ventasFilter = 'todas';

async function loadData() {
    try {
        const res = await fetch('/api/data');
        data = await res.json();
        // Inicializar gastos si no existe
        if (!data.gastos) data.gastos = [];
        renderAll();
        setupVentasFilters();
    } catch (err) {
        console.error('Error cargando datos:', err);
    }
}

async function saveData() {
    try {
        const res = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) showToast();
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

function renderVentasResumen() {
    if (!data.ventas) return;
    const pagadas = data.ventas.filter(v => v.pagado);
    const pendientes = data.ventas.filter(v => !v.pagado);
    const sinFactura = data.ventas.filter(v => !v.facturado);

    const totalPagado = pagadas.reduce((s, v) => s + v.monto, 0);
    const totalPendiente = pendientes.reduce((s, v) => s + v.monto, 0);
    const totalSinFactura = sinFactura.reduce((s, v) => s + v.monto, 0);

    document.getElementById('ventas-resumen').innerHTML = `
        <div class="stat-card">
            <div class="stat-value" style="color:var(--success)">$${(totalPagado / 1000000).toFixed(1)}M</div>
            <div class="stat-label">✅ Pagado (${pagadas.length})</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color:var(--danger)">$${(totalPendiente / 1000).toFixed(0)}k</div>
            <div class="stat-label">💵 Por Cobrar (${pendientes.length})</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color:var(--warning)">$${(totalSinFactura / 1000).toFixed(0)}k</div>
            <div class="stat-label">📄 Sin Factura (${sinFactura.length})</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.ventas.length}</div>
            <div class="stat-label">Total Ventas</div>
        </div>
    `;
}

function renderFlujo() {
    if (!data.gastos) data.gastos = [];

    // Calcular totales por categoría
    const categorias = {
        'materia_prima': { nombre: '☕ Café Verde', total: 0, emoji: '☕' },
        'logistica': { nombre: '🚚 Logística', total: 0, emoji: '🚚' },
        'marketing': { nombre: '📣 Marketing', total: 0, emoji: '📣' },
        'empaque': { nombre: '📦 Empaque', total: 0, emoji: '📦' },
        'otros': { nombre: '📋 Otros', total: 0, emoji: '📋' }
    };

    data.gastos.forEach(g => {
        if (categorias[g.categoria]) {
            categorias[g.categoria].total += g.monto;
        }
    });

    const totalGastos = data.gastos.reduce((s, g) => s + g.monto, 0);
    const totalIngresos = data.ventas ? data.ventas.filter(v => v.pagado).reduce((s, v) => s + v.monto, 0) : 0;
    const flujoNeto = totalIngresos - totalGastos;

    document.getElementById('flujo-resumen').innerHTML = `
        <div class="stat-card">
            <div class="stat-value" style="color:var(--success)">$${(totalIngresos / 1000000).toFixed(1)}M</div>
            <div class="stat-label">📥 Ingresos (Pagados)</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color:var(--danger)">$${(totalGastos / 1000).toFixed(0)}k</div>
            <div class="stat-label">📤 Egresos</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color:${flujoNeto >= 0 ? 'var(--success)' : 'var(--danger)'}">$${(flujoNeto / 1000000).toFixed(2)}M</div>
            <div class="stat-label">💰 Flujo Neto</div>
        </div>
        ${Object.entries(categorias).map(([k, v]) => `
            <div class="stat-card">
                <div class="stat-value" style="font-size:1.25rem">$${(v.total / 1000).toFixed(0)}k</div>
                <div class="stat-label">${v.emoji} ${k.charAt(0).toUpperCase() + k.slice(1).replace('_', ' ')}</div>
            </div>
        `).join('')}
    `;

    // Renderizar lista de gastos
    document.getElementById('flujo-grid').innerHTML = data.gastos.length ? data.gastos.slice(0, 20).map(g => `
        <div class="card">
            <div class="card-header">
                <span class="card-title">${categorias[g.categoria]?.emoji || '📋'} ${g.descripcion}</span>
                <span class="badge badge-${g.categoria === 'materia_prima' ? 'b2b' : g.categoria === 'logistica' ? 'proceso' : 'idea'}">${g.categoria.replace('_', ' ')}</span>
            </div>
            <div style="font-size:1.5rem;font-weight:700;color:var(--danger)">-$${g.monto.toLocaleString()}</div>
            <div class="card-meta">
                <span class="card-detail">📅 ${g.fecha}</span>
                ${g.proveedor ? `<span class="card-detail">🏢 ${g.proveedor}</span>` : ''}
            </div>
            ${g.notas ? `<div class="card-detail" style="margin-top:0.5rem">${g.notas}</div>` : ''}
        </div>
    `).join('') : '<div class="card">Aún no hay gastos registrados. Usa "+ Nuevo Gasto" para agregar.</div>';
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
    const b2bProg = Math.min(100, (data.ventas?.filter(v => v.tipo === 'b2b').reduce((s, v) => s + v.kg, 0) / data.metas.b2b.meta) * 100 || 0);
    const b2pProg = Math.min(100, (data.ventas?.filter(v => v.tipo === 'b2p').reduce((s, v) => s + v.monto, 0) / data.metas.b2p.meta) * 100 || 0);

    document.getElementById('metas-progress').innerHTML = `
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
    const tb2b = data.ventas?.filter(v => v.tipo === 'b2b').reduce((s, v) => s + v.kg, 0) || 0;
    const tb2p = data.ventas?.filter(v => v.tipo === 'b2p').reduce((s, v) => s + v.monto, 0) || 0;

    document.getElementById('metas-overview').innerHTML = `
        <div class="cards-grid">
            <div class="card">
                <div class="card-header"><span class="card-title">🎯 Meta B2B</span><span class="badge badge-b2b">B2B</span></div>
                <div style="font-size:2rem;font-weight:700;color:var(--accent)">${tb2b.toFixed(1)} / ${data.metas.b2b.meta}</div>
                <div class="card-detail">${data.metas.b2b.unidad}</div>
                <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, tb2b / data.metas.b2b.meta * 100)}%"></div></div>
            </div>
            <div class="card">
                <div class="card-header"><span class="card-title">🛒 Meta B2P</span><span class="badge badge-b2p">B2P</span></div>
                <div style="font-size:2rem;font-weight:700;color:var(--accent)">$${(tb2p / 1000).toFixed(0)}k / $${(data.metas.b2p.meta / 1000000).toFixed(1)}M</div>
                <div class="card-detail">${data.metas.b2p.unidad}</div>
                <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, tb2p / data.metas.b2p.meta * 100)}%"></div></div>
            </div>
        </div>
    `;
}

function renderEstadoResultados() {
    if (!data.estadoResultados?.meses) return;
    document.getElementById('estado-resultados').innerHTML = data.estadoResultados.meses.map(m => `
        <div class="card">
            <div class="card-header"><span class="card-title">📊 ${m.mes}</span></div>
            <div class="kpi-grid">
                <div class="kpi-item"><span class="kpi-label">Ingresos</span><span class="kpi-value" style="color:var(--success)">$${(m.ingresos.total / 1000).toFixed(0)}k</span></div>
                <div class="kpi-item"><span class="kpi-label">Costos</span><span class="kpi-value" style="color:var(--danger)">-$${(m.costos.total / 1000).toFixed(0)}k</span></div>
                <div class="kpi-item"><span class="kpi-label">Utilidad</span><span class="kpi-value" style="color:${m.utilidad >= 0 ? 'var(--success)' : 'var(--danger)'}">$${(m.utilidad / 1000).toFixed(0)}k</span></div>
            </div>
        </div>
    `).join('');
}

// Estado de meses expandidos
let mesesExpandidos = {};

function renderVentas() {
    if (!data.ventas) return;
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

    document.getElementById('ventas-grid').innerHTML = html || '<div class="card">No hay ventas con este filtro</div>';
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
    document.getElementById('agentes-grid').innerHTML = data.agentes.map(a => `
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
    if (type === 'venta') {
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
                            <input type="number" class="form-input producto-precio" placeholder="$" value="${p.precio || ''}" style="width:100%">
                            <button type="button" onclick="eliminarLineaProducto(this)" style="background:var(--danger);color:white;border:none;width:30px;height:30px;border-radius:4px;cursor:pointer">×</button>
                        </div>
                    `).join('') : ''}
                </div>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                <div class="form-group"><label class="form-label">Kg Total</label><input type="number" step="0.5" class="form-input" id="venta-kg" value="${venta?.kg || ''}"></div>
                <div class="form-group"><label class="form-label">Monto Total (CLP)</label><input type="number" class="form-input" id="venta-monto" value="${venta?.monto || ''}"></div>
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
            <div class="form-group"><label class="form-label">Descripción</label><input type="text" class="form-input" id="gasto-desc" placeholder="Ej: Compra café verde Brasil"></div>
            <div class="form-group"><label class="form-label">Categoría</label>
                <select class="form-select" id="gasto-cat">
                    <option value="materia_prima">☕ Materia Prima (Café Verde)</option>
                    <option value="logistica">🚚 Logística (Envíos)</option>
                    <option value="empaque">📦 Empaque</option>
                    <option value="marketing">📣 Marketing</option>
                    <option value="otros">📋 Otros</option>
                </select>
            </div>
            <div class="form-group"><label class="form-label">Monto (CLP)</label><input type="number" class="form-input" id="gasto-monto"></div>
            <div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" id="gasto-fecha"></div>
            <div class="form-group"><label class="form-label">Proveedor (opcional)</label><input type="text" class="form-input" id="gasto-prov"></div>
            <div class="form-group"><label class="form-label">Notas</label><textarea class="form-textarea" id="gasto-notas"></textarea></div>
        `;
    }
    document.getElementById('modal-body').innerHTML = html;
}

document.getElementById('modal-save').addEventListener('click', () => {
    if (currentModal === 'venta') {
        // Recopilar líneas de producto
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

        data.ventas = data.ventas || [];

        if (editingId) {
            // Editar venta existente
            const index = data.ventas.findIndex(v => v.id === editingId);
            if (index !== -1) {
                data.ventas[index] = { ...data.ventas[index], ...ventaData };
            }
        } else {
            // Nueva venta
            ventaData.id = Date.now();
            data.ventas.unshift(ventaData);
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
        data.clientes = data.clientes || [];
        data.clientes.push(newCliente);
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
        data.calendario = data.calendario || [];
        data.calendario.push(newPost);
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
        data.tareas = data.tareas || [];
        data.tareas.push(newTarea);
    } else if (currentModal === 'inventario') {
        const newInv = {
            id: Date.now(),
            origen: document.getElementById('inv-origen').value,
            stockActual: parseInt(document.getElementById('inv-stock').value) || 0,
            puntoReorden: parseInt(document.getElementById('inv-reorden').value) || 10,
            proveedor: document.getElementById('inv-prov').value
        };
        data.inventario = data.inventario || [];
        data.inventario.push(newInv);
    } else if (currentModal === 'gasto') {
        const newGasto = {
            id: Date.now(),
            descripcion: document.getElementById('gasto-desc').value,
            categoria: document.getElementById('gasto-cat').value,
            monto: parseInt(document.getElementById('gasto-monto').value) || 0,
            fecha: document.getElementById('gasto-fecha').value || new Date().toISOString().split('T')[0],
            proveedor: document.getElementById('gasto-prov').value,
            notas: document.getElementById('gasto-notas').value
        };
        data.gastos = data.gastos || [];
        data.gastos.unshift(newGasto);
    }
    saveData();
    closeModal();
    renderAll();
});

function editCliente(id) { openModal('cliente', id); }
function editVenta(id) { openModal('venta', id); }
function contactCliente(nombre) { window.open(`https://wa.me/?text=Hola ${encodeURIComponent(nombre)}, te escribo de Candela Coffee...`); }

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
        <input type="number" class="form-input producto-precio" placeholder="$" style="width:100%">
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
        totalKg += parseFloat(linea.querySelector('.producto-kg').value) || 0;
        totalMonto += parseInt(linea.querySelector('.producto-precio').value) || 0;
    });
    document.getElementById('venta-kg').value = totalKg;
    document.getElementById('venta-monto').value = totalMonto;
}

// Init
loadData();
