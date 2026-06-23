// Reemplaza esta URL con la que te genere Google Apps Script al publicar el Web App
const API_URL = 'https://script.google.com/macros/s/AKfycbwOM7Ofw3SCrxMEhbv-bNlczigjtlR0bBQiudFK7x-hf01iIjj8gZzq8isOF1zMaXA9/exec'; 

const app = {
    state: {
        estudiantes: [],
        entidades: [],
        sesiones: [],
        documentos: [],
        estudianteActual: null
    },

    init() {
        this.setupRouter();
        this.loadInitialData();
    },

    setupRouter() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.dataset.view;
                this.navigate(view);
            });
        });
    },

    navigate(viewId) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (navItem) navItem.classList.add('active');

        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        const targetView = document.getElementById(`view-${viewId}`);
        if (targetView) targetView.classList.add('active');

        if (viewId === 'dashboard') this.renderDashboard();
        if (viewId === 'estudiantes') this.renderEstudiantes();
        if (viewId === 'entidades') this.renderEntidades();
        
        lucide.createIcons();
    },

    async loadInitialData() {
        if(API_URL.includes('TU_ID')) {
            alert('Atención: Debes configurar la constante API_URL en app.js con la URL de tu Google Apps Script.');
            return;
        }

        document.getElementById('dash-total-est').textContent = '...';
        await Promise.all([
            this.fetchEstudiantes(),
            this.fetchEntidades(),
            this.fetchSesiones(),
            this.fetchDocumentos()
        ]);
        this.navigate('dashboard');
    },

    async fetchSheet(sheetName) {
        try {
            const res = await fetch(`${API_URL}?sheet=${sheetName}`);
            const json = await res.json();
            return json.data ? json.data.slice(1) : []; // saltar encabezados
        } catch (e) {
            console.error(`Error fetching ${sheetName}`, e);
            return [];
        }
    },

    async postSheet(payload) {
        try {
            // Se usa text/plain para evitar el preflight OPTIONS de CORS
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            return json;
        } catch(e) {
            console.error('Error posting data', e);
            throw e;
        }
    },

    async fetchEstudiantes() {
        const rows = await this.fetchSheet('estudiantes');
        this.state.estudiantes = rows.map(row => ({
            id: row[0], nombre: row[1], apellido: row[2],
            grado: row[3], grupo: row[4], documento: row[5],
            acudiente: row[6], telefono: row[7], estado_sseo: row[8],
            horas_completadas: parseInt(row[9] || '0', 10),
            entidad_actual: row[10], fecha_inicio: row[11],
            fecha_fin: row[12], servicio_cancelado: (row[13] === true || row[13] === 'TRUE'),
            motivo_cancelacion: row[14]
        }));
    },

    async fetchEntidades() {
        const rows = await this.fetchSheet('entidades');
        this.state.entidades = rows.map(row => ({
            id: row[0], nombre: row[1], tipo: row[2],
            nit: row[3], direccion: row[4], telefono: row[5],
            contacto: row[6], email: row[7],
            aprobada: (row[8] === true || row[8] === 'TRUE'),
            fecha_aprobacion: row[9], cupo_maximo: parseInt(row[10] || '0', 10),
            estudiantes_activos: parseInt(row[11] || '0', 10)
        }));
    },

    async fetchSesiones() {
        const rows = await this.fetchSheet('sesiones');
        this.state.sesiones = rows.map(row => ({
            id: row[0], estudiante_id: row[1], fecha: row[2],
            horas: parseInt(row[3] || '0', 10), entidad_id: row[4],
            supervisor: row[5], actividad: row[6],
            inasistencia: (row[7] === true || row[7] === 'TRUE'),
            justificada: (row[8] === true || row[8] === 'TRUE'),
            observaciones: row[9]
        }));
    },

    async fetchDocumentos() {
        const rows = await this.fetchSheet('documentos');
        this.state.documentos = rows.map(row => ({
            id: row[0], estudiante_id: row[1], tipo_documento: row[2],
            entregado: (row[3] === true || row[3] === 'TRUE'),
            fecha_entrega: row[4], observaciones: row[5]
        }));
    },

    // --- DASHBOARD ---
    renderDashboard() {
        const ests = this.state.estudiantes;
        
        document.getElementById('dash-total-est').textContent = ests.length;
        
        const completos = ests.filter(e => e.horas_completadas >= 80).length;
        const pct = ests.length ? Math.round((completos / ests.length) * 100) : 0;
        document.getElementById('dash-completos').textContent = `${pct}%`;

        // Riesgo (≥ 2 inasistencias injustificadas)
        const inasistencias = {};
        this.state.sesiones.forEach(s => {
            if (s.inasistencia && !s.justificada) {
                inasistencias[s.estudiante_id] = (inasistencias[s.estudiante_id] || 0) + 1;
            }
        });
        const enRiesgo = Object.keys(inasistencias).filter(id => inasistencias[id] >= 2).length;
        document.getElementById('dash-riesgo').textContent = enRiesgo;

        // Top 5 closer to 80h
        const top5 = [...ests]
            .filter(e => e.horas_completadas < 80 && !e.servicio_cancelado)
            .sort((a, b) => b.horas_completadas - a.horas_completadas)
            .slice(0, 5);

        const tbody = document.querySelector('#table-top-5 tbody');
        tbody.innerHTML = top5.map(e => `
            <tr>
                <td>${e.nombre} ${e.apellido}</td>
                <td>
                    <div class="progress-container">
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${(e.horas_completadas/80)*100}%"></div>
                        </div>
                        <span class="progress-text">${e.horas_completadas}/80</span>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    // --- ESTUDIANTES ---
    renderEstudiantes() {
        const query = document.getElementById('search-est')?.value.toLowerCase() || '';
        let filtered = this.state.estudiantes;
        
        if (query) {
            filtered = filtered.filter(e => 
                e.nombre.toLowerCase().includes(query) || 
                e.apellido.toLowerCase().includes(query)
            );
        }

        const tbody = document.querySelector('#table-estudiantes tbody');
        tbody.innerHTML = filtered.map(e => {
            const badgeClass = e.estado_sseo.toLowerCase().replace(' ', '-');
            return `
            <tr onclick="app.verFicha('${e.id}')">
                <td>${e.nombre} ${e.apellido}</td>
                <td>${e.grado} - ${e.grupo}</td>
                <td>
                    <div class="progress-container">
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${Math.min((e.horas_completadas/80)*100, 100)}%"></div>
                        </div>
                        <span class="progress-text">${e.horas_completadas}/80</span>
                    </div>
                </td>
                <td><span class="badge ${badgeClass}">${e.estado_sseo}</span></td>
            </tr>
        `}).join('');
    },

    async verFicha(id) {
        const est = this.state.estudiantes.find(e => e.id === id);
        if(!est) return;
        this.state.estudianteActual = est;
        
        const estSesiones = this.state.sesiones.filter(s => s.estudiante_id === id);
        const estDocs = this.state.documentos.filter(d => d.estudiante_id === id);
        
        // Riesgo semáforo
        const inasistencias = estSesiones.filter(s => s.inasistencia && !s.justificada).length;
        let semaforoDot = 'green';
        let semaforoText = 'Bajo Riesgo';
        if (inasistencias === 2) {
            semaforoDot = 'yellow';
            semaforoText = 'En Riesgo (2 inasistencias)';
        }
        if (est.servicio_cancelado || inasistencias >= 3) {
            semaforoDot = 'red';
            semaforoText = 'Servicio Cancelado';
        }

        const badgeClass = est.estado_sseo.toLowerCase().replace(' ', '-');
        const docsLista = ['Solicitud de ingreso', 'Hoja de control', 'Evaluación supervisor', 'Autoevaluación'];
        
        const docChecks = docsLista.map(d => {
            const docObj = estDocs.find(doc => doc.tipo_documento === d);
            const isChecked = docObj ? docObj.entregado : false;
            return `
            <div class="checklist-item">
                <span>${d}</span>
                <input type="checkbox" ${isChecked ? 'checked' : ''} disabled>
            </div>
            `;
        }).join('');

        const content = `
            <div class="ficha-header">
                <div class="ficha-info">
                    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 8px;">
                        <h2 style="margin: 0">${est.nombre} ${est.apellido}</h2>
                        <span class="badge ${badgeClass}">${est.estado_sseo}</span>
                    </div>
                    <p>Documento: ${est.documento} | Grado: ${est.grado}</p>
                    <div class="semaforo mt-2" style="margin-top: 12px">
                        <div class="dot ${semaforoDot}"></div>
                        <span>${semaforoText}</span>
                    </div>
                </div>
                <div class="ficha-horas-large">
                    <div class="num">${est.horas_completadas}</div>
                    <div class="label">de 80 horas obligatorias</div>
                </div>
            </div>

            <div class="ficha-grid">
                <div>
                    <div class="view-header" style="margin-bottom: 16px;">
                        <h3>Historial de Sesiones</h3>
                        <button class="btn btn-primary" onclick="app.abrirModalSesion('${est.id}')" ${est.servicio_cancelado ? 'disabled' : ''}>+ Registrar Sesión</button>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Horas</th>
                                    <th>Actividad / Obs.</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${estSesiones.map(s => `
                                    <tr>
                                        <td>${s.fecha}</td>
                                        <td>${s.inasistencia ? '<span class="text-danger">Inasistencia</span>' : s.horas + 'h'}</td>
                                        <td>${s.inasistencia && !s.justificada ? 'Injustificada' : (s.actividad || s.observaciones)}</td>
                                    </tr>
                                `).join('')}
                                ${estSesiones.length === 0 ? '<tr><td colspan="3">No hay sesiones registradas.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div>
                    <div class="view-header" style="margin-bottom: 16px;">
                        <h3>Documentos</h3>
                    </div>
                    <div class="checklist mb-4">
                        ${docChecks}
                    </div>
                    
                    <button class="btn ${est.horas_completadas >= 80 ? 'btn-primary' : 'btn-outline'} w-full" 
                            onclick="app.generarCertificado('${est.id}')"
                            ${est.horas_completadas < 80 ? 'disabled' : ''}>
                        Generar Certificado
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('ficha-content').innerHTML = content;
        this.navigate('ficha');
    },

    // --- ENTIDADES ---
    renderEntidades() {
        const tbody = document.querySelector('#table-entidades tbody');
        tbody.innerHTML = this.state.entidades.map(e => {
            const badgeClass = e.aprobada ? 'aprobada' : 'pendiente';
            return `
            <tr>
                <td>${e.nombre}</td>
                <td>${e.tipo}</td>
                <td>${e.estudiantes_activos}/${e.cupo_maximo}</td>
                <td><span class="badge ${badgeClass}">${e.aprobada ? 'Aprobada' : 'Pendiente'}</span></td>
                <td>
                    ${!e.aprobada ? `<button class="btn btn-outline" onclick="app.aprobarEntidad('${e.id}')">Aprobar</button>` : ''}
                </td>
            </tr>
        `}).join('');
    },

    async aprobarEntidad(id) {
        try {
            await this.postSheet({
                action: 'update',
                sheet: 'entidades',
                id: id,
                updates: [
                    {col: 9, val: 'TRUE'}, // aprobada (columna I = 9)
                    {col: 10, val: new Date().toISOString().split('T')[0]} // fecha_aprobacion
                ]
            });
            alert("Entidad aprobada");
            await this.fetchEntidades();
            this.renderEntidades();
        } catch (e) {
            alert('Error aprobando');
        }
    },

    // --- MODALES Y SESIONES ---
    abrirModalSesion(estId) {
        document.getElementById('sesion-est-id').value = estId;
        document.getElementById('sesion-fecha').value = new Date().toISOString().split('T')[0];
        
        const select = document.getElementById('sesion-entidad');
        select.innerHTML = this.state.entidades
            .filter(e => e.aprobada)
            .map(e => `<option value="${e.id}">${e.nombre}</option>`)
            .join('');

        document.getElementById('modal-overlay').style.display = 'flex';
        document.getElementById('modal-sesion').style.display = 'block';
    },

    cerrarModales() {
        document.getElementById('modal-overlay').style.display = 'none';
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        document.getElementById('form-sesion').reset();
    },

    toggleInasistenciaFields() {
        const isI = document.getElementById('sesion-is-inasistencia').checked;
        document.getElementById('group-horas').style.display = isI ? 'none' : 'block';
        document.getElementById('group-justificada').style.display = isI ? 'block' : 'none';
        document.getElementById('sesion-horas').required = !isI;
    },

    async submitSesion(e) {
        e.preventDefault();
        const isInasistencia = document.getElementById('sesion-is-inasistencia').checked;
        const horas = parseInt(document.getElementById('sesion-horas').value || '0', 10);
        
        // REGLA: Max 8h por sesión (Resolución 4210)
        if (!isInasistencia && horas > 8) {
            alert("Error: Según la Resolución 4210, no se permite registrar más de 8 horas por sesión/día.");
            return;
        }

        const estId = document.getElementById('sesion-est-id').value;
        const est = this.state.estudiantes.find(es => es.id === estId);
        if (est.servicio_cancelado) {
            alert("No se pueden registrar horas. El servicio está cancelado.");
            return;
        }

        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = "Guardando...";

        try {
            const sessionId = Date.now().toString();
            const justificada = isInasistencia ? document.getElementById('sesion-justificada').checked : false;
            
            // 1. Guardar la sesión
            await this.postSheet({
                action: 'append',
                sheet: 'sesiones',
                row: [
                    sessionId, 
                    estId, 
                    document.getElementById('sesion-fecha').value, 
                    isInasistencia ? 0 : horas,
                    document.getElementById('sesion-entidad').value,
                    document.getElementById('sesion-supervisor').value,
                    isInasistencia ? 'Inasistencia' : document.getElementById('sesion-actividad').value,
                    isInasistencia ? 'TRUE' : 'FALSE',
                    justificada ? 'TRUE' : 'FALSE',
                    document.getElementById('sesion-actividad').value,
                    'Docente Frontend',
                    new Date().toISOString()
                ]
            });

            // 2. Procesar lógica de actualización de estudiante
            let updates = [];
            
            if (!isInasistencia) {
                const nuevasHoras = est.horas_completadas + horas;
                updates.push({col: 10, val: nuevasHoras}); // J = 10 (horas_completadas)
                let nuevoEstado = est.estado_sseo;
                if (nuevasHoras >= 80) nuevoEstado = 'Completo';
                else if (nuevasHoras > 0) nuevoEstado = 'En curso';
                updates.push({col: 9, val: nuevoEstado}); // I = 9 (estado_sseo)
            } else if (!justificada) {
                // Verificar si con esta llega a 3
                const prevInasistencias = this.state.sesiones.filter(s => s.estudiante_id === estId && s.inasistencia && !s.justificada).length;
                if (prevInasistencias + 1 >= 3) {
                    updates.push({col: 9, val: 'Cancelado'}); // estado
                    updates.push({col: 14, val: 'TRUE'}); // servicio_cancelado
                    updates.push({col: 15, val: 'Exceso de inasistencias injustificadas (3)'}); // motivo
                    alert("ATENCIÓN: Se ha registrado la inasistencia. El servicio del estudiante ha sido CANCELADO por acumular 3 inasistencias injustificadas.");
                }
            }

            if (updates.length > 0) {
                await this.postSheet({
                    action: 'update',
                    sheet: 'estudiantes',
                    id: estId,
                    updates: updates
                });
            }

            alert("Sesión guardada exitosamente.");
            this.cerrarModales();
            
            // Recargar datos
            await Promise.all([this.fetchEstudiantes(), this.fetchSesiones()]);
            this.verFicha(estId);

        } catch (err) {
            console.error(err);
            alert("Ocurrió un error guardando la sesión.");
        } finally {
            btn.disabled = false;
            btn.textContent = "Guardar";
        }
    },

    // --- CERTIFICADO ---
    async generarCertificado(estId) {
        const est = this.state.estudiantes.find(e => e.id === estId);
        
        // Validación final
        if (est.horas_completadas < 80 || est.servicio_cancelado) {
            alert("No cumple requisitos para certificación.");
            return;
        }

        const content = `
            <div class="certificado">
                <h1>CERTIFICADO DE CUMPLIMIENTO SSEO</h1>
                <p>La institución <strong>Colegio de Ejemplo</strong> hace constar que el/la estudiante:</p>
                <h2>${est.nombre} ${est.apellido}</h2>
                <p>Identificado(a) con documento N° ${est.documento}, ha cumplido satisfactoriamente con el Servicio Social Estudiantil Obligatorio (SSEO), realizando un total de <strong>${est.horas_completadas} horas</strong>.</p>
                <p>Este certificado se expide en cumplimiento del Artículo 97 de la Ley 115 de 1994 y la Resolución 4210 de 1996 del MEN.</p>
                <br><br><br>
                <p>____________________________________</p>
                <p><strong>Coordinador General</strong></p>
                <p>Fecha de emisión: ${new Date().toISOString().split('T')[0]}</p>
            </div>
        `;
        
        document.getElementById('view-certificado').innerHTML = content;
        
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-certificado').classList.add('active');
        
        setTimeout(() => {
            window.print();
            this.navigate('ficha');
        }, 500);
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
