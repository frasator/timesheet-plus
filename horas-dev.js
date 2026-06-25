/**
 * TimesheetPlus - Componente que complementa el timesheet original
 * 
 * Responsabilidades:
 * 1. DOM Exploration: Extrae información del timesheet original de la página
 * 2. Panel Rendering: Renderiza un panel lateral con información adicional y controles
 * 
 * Organización:
 * - Lifecycle: constructor, init, render, refresh
 * - DOM Queries: Métodos que extraen datos del DOM original
 * - Data Processing: Métodos que procesan y calculan datos
 * - Render Methods: Métodos que retornan HTML templates
 * - User Actions: Handlers de acciones del usuario
 * - Storage: Persistencia en localStorage
 * - Utilities: Funciones auxiliares
 */
class TimesheetPlus {
    // ============================================================================
    // LIFECYCLE - Ciclo de vida del componente
    // ============================================================================

    constructor() {
        // Aplicar estilos estáticos
        this.aplicarEstilos()

        // Crear elemento raíz del componente usando TimesheetPlus.html()
        this.element = TimesheetPlus.html`<div id="TimesheetPlus" class="shadow1 fs110"></div>`

        // Constantes de tiempo
        this.TIEMPO_ESPERA_DOM = 1000
        this.INTERVALO_ACTUALIZACION = 3000
        this.INTERVALO_KEEP_ALIVE = 60000 * 15
        this.INTERVALO_BUSCAR_CONTAINER = 4000
        this.DELAY_ESPERA_CORTO = 100
        this.DELAY_ESPERA_CLICK = 20
        this.DELAY_GUARDAR = 10
        this.TIEMPO_INACTIVIDAD_USUARIO = 2000
        this.DURACION_ENTRADA_INICIAL = 5 * 60000
        this.OFFSET_SCROLL_DIA = 110

        // Selectores CSS del timesheet original
        this.SELECTORES = {
            titulosDias: '.wx-timesheet-day__header-weekday',
            todosDias: 'wx-timesheet-day',
            tituloDia: '[class^="wx-timesheet-day"]',
            resumenDia: '.wx-timesheet-day__summary',
            indicadoresDia: '.wx-timesheet-day__indicators',
            editoresInicioFin: '.wx-timesheet-start-end-editor',
            inputTiempo: '.wx-time-input',
            inputHoras: '.wx-time-input__hours',
            inputMinutos: '.wx-time-input__minutes',
            flechaArriba: '.wx-time-input__up-arrow',
            areasTexto: 'textarea',
            comentarios: '.wx-comment__body',
            botonEnviar: '#timesheet-action-button-submit',
            botonAgregar: 'button[aria-label="Add"]',
            botonEliminar: 'button[aria-label="Delete"]'
        }

        // Configuración del componente
        this.config = {
            indicadoresNoTrabajo: [
                'indicator-holiday',
                'indicator-vacation-pending',
                'indicator-vacation-approved',
                'indicator-absence-pending',
                'indicator-absence-approved',
            ],
            meses: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
            minutosJornada: 7 * 60 + 45,
            minutosMediaJornada: 4 * 60
        }

        // Estado reactivo del componente
        this.estado = {
            inicializado: false,
            datos: null,              // Datos del mes (días laborables, etc.)
            tiempoTrabajadoMes: null, // Tiempo total trabajado en el mes
            tiempoTrabajadoHoy: null  // Tiempo trabajado hoy
        }

        // Cache temporal para evitar releer el mismo día en una pasada
        this.cache = {
            tiposDia: {}            // Cache temporal de tipos de día (se limpia cada pasada)
        }

        this.ultimaActividadUsuario = 0

        // Intervalos de actualización
        this.intervalos = {
            intentarInit: null,
            actualizar: null,
            mantenerVivo: null
        }

        this.configurarDeteccionActividadUsuario()

        // Inicializar cuando el DOM esté listo
        this.iniciarCuandoEsteListaLaPagina()
    }

    /**
     * Registra actividad real del usuario para evitar actualizar mientras interactúa
     */
    configurarDeteccionActividadUsuario() {
        const eventosActividad = [
            'keydown',
            'keyup',
            'mousedown',
            'mousemove',
            'pointerdown',
            'pointermove',
            'touchstart',
            'touchmove',
            'wheel',
            'input',
            'change',
            'scroll'
        ]

        const registrarActividad = (evento) => {
            if (evento.isTrusted) {
                this.ultimaActividadUsuario = Date.now()
            }
        }

        eventosActividad.forEach(evento => {
            window.addEventListener(evento, registrarActividad, { capture: true, passive: true })
        })
    }

    /**
     * Indica si el usuario lleva suficiente tiempo sin interactuar con la página
     */
    usuarioEstaInactivo() {
        return Date.now() - this.ultimaActividadUsuario >= this.TIEMPO_INACTIVIDAD_USUARIO
    }

    /**
     * Indica si la página original está cargando contenido
     */
    hayLoaderActivo() {
        return document.body?.querySelectorAll('sds-loader').length > 0
    }

    /**
     * Indica si se puede leer o modificar el DOM original del timesheet
     */
    puedeSincronizarConTimesheet() {
        return this.usuarioEstaInactivo() && !this.hayLoaderActivo()
    }

    /**
     * Aplica los estilos estáticos del componente al documento
     */
    aplicarEstilos() {
        const idEstilo = 'timesheetplus-styles'

        // Evitar duplicar estilos
        if (document.getElementById(idEstilo)) return

        const estilo = document.createElement('style')
        estilo.id = idEstilo
        estilo.textContent = this.constructor.styles
        document.head.appendChild(estilo)
    }

    /**
     * Espera a que el contenedor del timesheet original esté disponible
     * y luego inicializa el componente
     */
    iniciarCuandoEsteListaLaPagina() {
        const intentarInit = async () => {
            const filaEncabezado = document.querySelector('.wx-timesheet__header-placeholder')
            if (filaEncabezado && !document.getElementById('TimesheetPlus')) {
                console.log('[TimesheetPlus] Contenedor encontrado, insertando elemento')
                filaEncabezado.appendChild(this.element)
                await this.inicializar()
            }
        }

        intentarInit()
        this.intervalos.intentarInit = setInterval(intentarInit, this.INTERVALO_BUSCAR_CONTAINER)
    }

    /**
     * Inicializa el componente una vez insertado en el DOM
     */
    async inicializar() {
        await new Promise(r => setTimeout(r, this.TIEMPO_ESPERA_DOM))

        // Limpiar intervalos anteriores
        clearInterval(this.intervalos.actualizar)
        clearInterval(this.intervalos.mantenerVivo)

        // Marcar como inicializado
        this.estado.inicializado = true

        // Renderizar estructura inicial
        await this.renderizar()

        // Configurar actualización automática cada 3 segundos
        this.intervalos.actualizar = setInterval(async () => {
            await this.actualizar()
        }, this.INTERVALO_ACTUALIZACION)

        // Mantener sesión activa (cada 15 minutos)
        this.intervalos.mantenerVivo = setInterval(async () => {
            await fetch(window.location.href)
        }, this.INTERVALO_KEEP_ALIVE)

        // Primera actualización de datos
        await this.actualizar()

        // Ocultar botón de enviar por defecto
        await new Promise(r => setTimeout(r, this.DELAY_ESPERA_CORTO))
        this.desactivarBotonEnviar()
    }

    /**
     * Renderiza el componente completo (método principal estilo Lit)
     */
    async renderizar() {
        const datos = this.estado.datos
        const tiempoMes = this.estado.tiempoTrabajadoMes

        // Mostrar solo botones mientras no hay datos (cargando o error)
        if (!datos || !tiempoMes) {
            const contenido = TimesheetPlus.html`
                <div class="timesheet-plus-container">
                    <div id="col1">
                        <div class="d-flex ai-c jc-c">
                            ${this.renderBotonInicio()}
                            ${this.renderBotonFin()}
                            ${this.renderBotonAuto()}
                            ${this.renderBotonMesAuto()}
                        </div>
                    </div>
                    <div id="col2"></div>
                </div>
            `
            this.element.replaceChildren(...contenido.children)
            return
        }

        // Obtener secciones del panel
        const hoyHTML = this.renderHoyHTML(datos)
        const mesHastaHoyHTML = this.renderMesHastaHoyHTML(datos, tiempoMes)
        const mesHTML = this.renderMesHTML(datos, tiempoMes)
        const configuracionHTML = this.renderConfiguracionHTML()
        const minutosMesesHTML = this.renderMinutosMesesHTML()

        // Renderizar estructura completa
        const contenido = TimesheetPlus.html`
            <div class="timesheet-plus-container">
                <div id="col1">
                    <div class="d-flex ai-c jc-c">
                        ${this.renderBotonInicio()}
                        ${this.renderBotonFin()}
                        ${this.renderBotonAuto()}
                        ${this.renderBotonMesAuto()}
                    </div>
                    ${hoyHTML}
                    ${mesHastaHoyHTML}
                    ${mesHTML}
                    ${configuracionHTML}
                </div>
                <div id="col2">
                    ${minutosMesesHTML}
                </div>
            </div>
        `

        // Actualizar DOM
        this.element.replaceChildren(...contenido.children)
    }

    /**
     * Actualiza los datos y re-renderiza el componente
     */
    async actualizar() {
        if (!this.estado.inicializado) return

        const puedeSincronizarConTimesheet = this.puedeSincronizarConTimesheet()

        try {
            if (puedeSincronizarConTimesheet) {
                // Actualizar datos del estado desde el timesheet original
                this.estado.datos = await this.obtenerDiasTrabajadosMes()
                this.estado.tiempoTrabajadoMes = await this.obtenerTiempoTrabajadoMes()
                this.estado.tiempoTrabajadoHoy = this.obtenerTiempoTrabajadoHoy()
            }

            // Re-renderizar componente con los últimos datos disponibles
            await this.renderizar()

            if (!puedeSincronizarConTimesheet) return

            // Operaciones adicionales en DOM externo
            await this.renderizarTiempoAcumuladoPorDia()
            await this.restaurarDiaExpandido(this.estado.datos)
            this.guardarMinutosRestantes(this.estado.datos)

            // Ajustar margen del timesheet original
            const diasMainBody = this.obtenerMain()
            if (diasMainBody) {
                diasMainBody.style.marginLeft = "20px"
            }
        } catch (error) {
            console.error('[TimesheetPlus] Error en actualizar:', error)
        }
    }

    // ============================================================================
    // DOM QUERIES - Extracción de información del DOM original
    // ============================================================================

    /**
     * Obtiene el contenedor principal del timesheet
     */
    obtenerMain() {
        return document.querySelector('.wx-timesheet__main-body')
    }

    /**
     * Obtiene la fecha del timesheet actual (ano y mes)
     */
    obtenerFechaHoja() {
        const tituloDia = document.querySelector('[id^="timesheet-day"]')
        const partes = tituloDia.getAttribute('id').split('timesheet-day-')[1].split('-')
        const ano = parseInt(partes[0])
        const mes = parseInt(partes[1])
        return { month: mes, year: ano }
    }

    /**
     * Genera el selector CSS para el día de hoy
     */
    getSelectorHoy() {
        const fechaActual = new Date()
        const ano = fechaActual.getFullYear()
        const mes = String(fechaActual.getMonth() + 1).padStart(2, '0')
        const diaMes = String(fechaActual.getDate()).padStart(2, '0')
        return `wx-timesheet-day > [id="timesheet-day-${ano}-${mes}-${diaMes}"]`
    }

    /**
     * Obtiene el elemento del día de hoy (método auxiliar para evitar repetición)
     */
    obtenerDiaHoy() {
        return this.obtenerMain().querySelector(this.getSelectorHoy())
    }

    /**
     * Obtiene la fecha de un día específico del timesheet
     */
    obtenerFechaDia(tituloDia) {
        const partes = tituloDia.getAttribute('id').split('timesheet-day-')[1].split('-')
        const ano = parseInt(partes[0])
        const mes = parseInt(partes[1]) - 1
        const dia = parseInt(partes[2])
        return new Date(ano, mes, dia, 0, 0, 1)
    }

    /**
     * Obtiene el tiempo trabajado hoy
     */
    obtenerTiempoTrabajadoHoy() {
        let horas = 0, minutos = 0
        const tituloDia = this.obtenerDiaHoy()

        if (tituloDia) {
            const resumenDia = tituloDia.querySelector(this.SELECTORES.resumenDia)
            const texto = resumenDia.innerText.trim()
            if (texto) {
                const partes = texto.split('h')
                horas = parseInt(partes[0].trim())
                minutos = parseInt(partes[1].trim().split('m')[0].trim())
            }
        }

        return {
            horas,
            minutos,
            totalMinutos: horas * 60 + minutos
        }
    }

    /**
     * Obtiene el tiempo total trabajado en el mes (excluyendo días de guardia)
     */
    async obtenerTiempoTrabajadoMes() {
        const todosDias = this.obtenerMain().querySelectorAll(this.SELECTORES.todosDias)
        let minutosAcumulados = 0

        // Deshabilitar interacción del usuario mientras leemos comentarios
        const estilosOriginales = this.deshabilitarInteraccionUsuario()

        for (const contenedorDia of todosDias) {
            const tituloDia = contenedorDia.querySelector(this.SELECTORES.tituloDia)
            const esDiaDeGuardia = await this.esDiaDeGuardia(tituloDia)

            if (!esDiaDeGuardia) {
                const resumenDia = contenedorDia.querySelector(this.SELECTORES.resumenDia)
                const texto = resumenDia.innerText.trim()

                if (texto) {
                    const [horasStr, minutosStr] = texto.split('h')
                    const horas = parseInt(horasStr.trim())
                    const minutos = parseInt(minutosStr.trim().split('m')[0].trim())
                    minutosAcumulados += horas * 60 + minutos
                }
            }
        }

        // Restaurar interacción del usuario
        this.restaurarInteraccionUsuario(estilosOriginales)

        return {
            horas: Math.floor(minutosAcumulados / 60),
            minutos: minutosAcumulados % 60,
            totalMinutos: minutosAcumulados
        }
    }

    // ============================================================================
    // DATA PROCESSING - Procesamiento y cálculo de datos
    // ============================================================================

    /**
     * Obtiene información completa de los días laborables del mes
     */
    async obtenerDiasTrabajadosMes() {
        const titulosDias = this.obtenerMain().querySelectorAll(this.SELECTORES.titulosDias)
        let tituloHoy = this.obtenerDiaHoy()

        if (tituloHoy === null) {
            // Si hoy no existe, asumir que el mes ya pasó y usar el último día
            tituloHoy = titulosDias[titulosDias.length - 1]
        }

        let contadorDias = 0
        let contadorNoTrabajo = 0
        let contadorMediosDias = 0
        let posicionHoy = 0
        let minutosATrabajar = 0
        let minutosATrabajarHastaHoy = 0

        // Deshabilitar interacción del usuario mientras leemos comentarios
        const estilosOriginales = this.deshabilitarInteraccionUsuario()

        // Guardar día expandido actual para restaurarlo al final
        const posicionScroll = document.body.scrollTop
        const diaExpandido = Array.from(titulosDias).find(tituloDia =>
            this.estaExpandido(tituloDia)
        )
        const datosDiaExpandido = diaExpandido ? { position: posicionScroll, elem: diaExpandido } : null

        // Limpiar caché temporal al inicio de cada pasada
        this.cache.tiposDia = {}

        // Clasificar días del mes
        const diasTrabajo = []
        for (const tituloDia of titulosDias) {
            const indicadoresDia = tituloDia.querySelector(this.SELECTORES.indicadoresDia)
            const esMedioDiaDeTrabajo = await this.esMedioDiaDeTrabajo(tituloDia)

            if (esMedioDiaDeTrabajo) {
                contadorMediosDias++
                minutosATrabajar += this.config.minutosMediaJornada
                diasTrabajo.push({ tituloDia, esMedio: true })
            } else if (this.esDiaDeTrabajo(indicadoresDia)) {
                contadorDias++
                minutosATrabajar += this.config.minutosJornada
                diasTrabajo.push({ tituloDia, esMedio: false })
            } else {
                contadorNoTrabajo++
            }
        }

        // Calcular días hasta hoy
        let enterosHastaHoy = 0
        let mediosHastaHoy = 0
        const ahora = new Date()

        for (const { tituloDia, esMedio } of diasTrabajo) {
            const fechaDia = this.obtenerFechaDia(tituloDia)
            const mismoMes = fechaDia.getMonth() === ahora.getMonth()
            const antesHoy = fechaDia <= ahora

            if (!mismoMes || antesHoy) {
                posicionHoy++
                if (esMedio) {
                    minutosATrabajarHastaHoy += this.config.minutosMediaJornada
                    mediosHastaHoy++
                } else {
                    minutosATrabajarHastaHoy += this.config.minutosJornada
                    enterosHastaHoy++
                }
            }
        }

        // Restaurar interacción del usuario
        this.restaurarInteraccionUsuario(estilosOriginales)

        return {
            posicionHoy,
            notrabajo: contadorNoTrabajo,
            total: contadorDias,
            totalMedios: contadorMediosDias,
            minutosATrabajar,
            minutosATrabajarHastaHoy,
            diasTrabajo,
            enterosHastaHoy,
            mediosHastaHoy,
            diaExpandido: datosDiaExpandido
        }
    }

    /**
     * Verifica si un día es laborable (no es festivo, vacaciones, etc.)
     */
    esDiaDeTrabajo(indicadoresDia) {
        if (!indicadoresDia || indicadoresDia.children.length === 0) {
            return true
        }

        const descendientes = indicadoresDia.querySelectorAll('*')
        return !Array.from(descendientes).some(descendiente =>
            Array.from(descendiente.classList).some(clase =>
                this.config.indicadoresNoTrabajo.some(indicador =>
                    clase.includes(indicador)
                )
            )
        )
    }

    /**
     * Verifica si un día es medio día de trabajo
     */
    async esMedioDiaDeTrabajo(tituloDia) {
        return this.esDiaDe('medio', tituloDia)
    }

    /**
     * Verifica si un día es de guardia
     */
    async esDiaDeGuardia(tituloDia) {
        return this.esDiaDe('guardia', tituloDia)
    }

    /**
     * Verifica si un día es de un tipo específico (medio día, guardia, etc.)
     * buscando en los comentarios del día
     */
    async esDiaDe(tipoDeDia, tituloDia) {
        const idDia = tituloDia.getAttribute('id')
        const claveCache = `${idDia}-${tipoDeDia}`

        // Verificar caché
        if (this.cache.tiposDia[claveCache] !== undefined) {
            return this.cache.tiposDia[claveCache]
        }

        const indicadoresDia = tituloDia.querySelector(this.SELECTORES.indicadoresDia)
        if (!indicadoresDia || indicadoresDia.children.length === 0) {
            this.cache.tiposDia[claveCache] = false
            return false
        }

        // Buscar indicador de comentario
        const tieneComentario = Array.from(indicadoresDia.querySelectorAll('*')).some(el =>
            Array.from(el.classList).some(clase => clase.includes('indicator-self-comment'))
        )

        if (!tieneComentario) {
            this.cache.tiposDia[claveCache] = false
            return false
        }

        // Abrir día temporalmente solo si está cerrado
        const estabaExpandidoInicialmente = this.estaExpandido(tituloDia)

        if (!estabaExpandidoInicialmente) {
            tituloDia.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
            await new Promise(r => setTimeout(r, this.DELAY_ESPERA_CLICK))
        }
        
        // Buscar el tipo de día en comentarios
        const areasTexto = Array.from(tituloDia.parentNode.querySelectorAll(this.SELECTORES.areasTexto))
        const comentarios = Array.from(tituloDia.parentNode.querySelectorAll(this.SELECTORES.comentarios))

        const resultado = areasTexto.some(el => el.value.toLowerCase().includes(tipoDeDia)) ||
                          comentarios.some(el => el.textContent.trim().toLowerCase().includes(tipoDeDia))

        // Cerrar día solo si nosotros lo abrimos
        if (!estabaExpandidoInicialmente) {
            tituloDia.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
            await new Promise(r => setTimeout(r, this.DELAY_ESPERA_CLICK))
        }

        // Guardar en caché
        this.cache.tiposDia[claveCache] = resultado
        return resultado
    }

    /**
     * Verifica si un día está expandido
     */
    estaExpandido(tituloDia) {
        return tituloDia.getAttribute('aria-expanded') === 'true'
    }

    /**
     * Verifica si un día es fin de semana
     */
    esFinde(tituloDia) {
        return tituloDia.classList.contains('weekend')
    }

    /**
     * Restaura el día expandido después de actualizar
     */
    async restaurarDiaExpandido(datos) {
        if (datos.diaExpandido) {
            document.body.scrollTo(0, datos.diaExpandido.position)
            const estaExpandido = this.estaExpandido(datos.diaExpandido.elem)

            if (!estaExpandido) {
                datos.diaExpandido.elem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
            }
        }
    }

    /**
     * Renderiza tiempo acumulado por día en el timesheet original
     */
    async renderizarTiempoAcumuladoPorDia() {
        const todosDias = this.obtenerMain().querySelectorAll(this.SELECTORES.todosDias)
        let minutosAcumulados = 0

        // Deshabilitar interacción del usuario mientras leemos comentarios
        const estilosOriginales = this.deshabilitarInteraccionUsuario()

        for (const contenedorDia of todosDias) {
            const tituloDia = contenedorDia.querySelector(this.SELECTORES.tituloDia)
            const esMedio = await this.esMedioDiaDeTrabajo(tituloDia)

            const minutosJornada = this.esFinde(tituloDia) ? 0 :
                (esMedio ? this.config.minutosMediaJornada : this.config.minutosJornada)

            const resumenDia = contenedorDia.querySelector(this.SELECTORES.resumenDia)
            const texto = resumenDia.innerText.trim()
            const id = tituloDia.getAttribute("id")
            const accumuladoId = `${id}-acumulado`

            const elementoAcumulado = tituloDia.querySelector(`#${accumuladoId}`)

            if (texto) {
                const [horasStr, minutosStr] = texto.split('h')
                const minutos = parseInt(horasStr.trim()) * 60 + parseInt(minutosStr.trim().split('m')[0].trim())
                const esDiaDeGuardia = await this.esDiaDeGuardia(tituloDia)

                if (!esDiaDeGuardia) {
                    const diferenciaMinutos = minutos - minutosJornada
                    minutosAcumulados += diferenciaMinutos

                    if (minutos > 0) {
                        const colorDiferenciaMin = diferenciaMinutos < 0 ? "naranja" : "turquesa"
                        const colorAcumuladoMin = minutosAcumulados < 0 ? "naranja" : "turquesa"

                        const nuevoElemento = TimesheetPlus.html`<div id="${accumuladoId}" class="acumulado-por-dia fs60">
                            <span class="gris">Día: </span>
                            <span class="${colorDiferenciaMin}" title="Horas trabajadas de más en el dia.">
                                ${this.renderMinutos(diferenciaMinutos, true)}
                            </span>
                            &nbsp;&nbsp;
                            <span class="gris">Mes: </span>
                            <span class="${colorAcumuladoMin}" title="Horas acumuladas en el mes hasta fecha.">
                                ${this.renderMinutos(minutosAcumulados, true)}
                            </span>
                        </div>`

                        if (elementoAcumulado) {
                            elementoAcumulado.replaceWith(nuevoElemento)
                        } else {
                            tituloDia.appendChild(nuevoElemento)
                        }
                    } else if (elementoAcumulado) {
                        elementoAcumulado.remove()
                    }
                } else if (elementoAcumulado) {
                    elementoAcumulado.remove()
                }
            } else if (elementoAcumulado) {
                elementoAcumulado.remove()
            }
        }

        // Restaurar interacción del usuario
        this.restaurarInteraccionUsuario(estilosOriginales)
    }

    // ============================================================================
    // RENDER METHODS - Templates HTML del panel
    // ============================================================================
    renderHoyHTML(datos) {
        const textoAyuda = 'Abrir hoy'
        const tiempoHoy = this.estado.tiempoTrabajadoHoy ?? { horas: 0, minutos: 0, totalMinutos: 0 }
        const datosHoy = datos.diasTrabajo[datos.posicionHoy - 1]
        const minutosJornadaHoy = datosHoy?.esMedio ? this.config.minutosMediaJornada : this.config.minutosJornada

        const handleMostrarHoy = () => {
            this.mostrarDia()
        }

        return TimesheetPlus.html`
            <div id="hoy">
                <div style="height:10px"></div>
                <div class="titulo1 d-flex">
                    <div class="i">Hoy</div>
                    <div class="flex"></div>
                    <div class="pntr azul" title="${textoAyuda}" @click=${handleMostrarHoy}>&#x27A1; &nbsp;</div>
                </div>
                <div class="contenido1">
                    <span class="verde b"> ${tiempoHoy.horas}h ${tiempoHoy.minutos}m  </span>
                    <span class=""> de </span>
                    <span class="b"> ${this.renderMinutos(minutosJornadaHoy)} </span>
                </div>
            </div>
        `
    }

    renderMesHastaHoyHTML(datos, tiempoMes) {
        const { minutosJornada, minutosMediaJornada } = this.config
        const minutosRestantes = tiempoMes.totalMinutos - datos.minutosATrabajarHastaHoy
        const colorRestantes = minutosRestantes < 0 ? 'naranja' : 'turquesa'
        const textoRestantes = minutosRestantes < 0 ? 'restantes' : 'de más'

        return TimesheetPlus.html`
            <div id="meshoy">
                <div style="height:10px"></div>
                <div class="titulo1 d-flex jc-sb">
                    <div class="i">Este mes hasta hoy</div>
                </div>
                <div class="contenido1">
                    <div class=" ">
                        <span class="b morado"> ${datos.posicionHoy}º día </span> de
                        <span class="b"> ${datos.total + datos.totalMedios} </span> días laborables
                    </div>
                    <div class=" ">
                        <span class="verde b"> ${this.renderMinutos(tiempoMes.totalMinutos)}</span>
                        <span class=""> de </span>
                        <span class="b"> ${this.renderMinutos(datos.minutosATrabajarHastaHoy)}</span>
                        <span class="gris fs80">
                            ${datos.enterosHastaHoy} x ${this.renderMinutos(minutosJornada)} +
                            ${datos.mediosHastaHoy} x ${this.renderMinutos(minutosMediaJornada)}
                        </span>
                    </div>
                    <div class=" ">
                        <span class="${colorRestantes} b"> ${this.renderMinutos(minutosRestantes, true)}</span> ${textoRestantes}
                    </div>
                </div>
                <div style="height:5px"></div>
                <div class="titulo1 d-flex jc-sb">
                    <div class="i">Hora de salida hoy</div>
                </div>
                <div class="contenido1">
                    ${this.obtenerHoraSalidaHoy(-minutosRestantes)}
                </div>
            </div>
        `
    }

    renderMesHTML(datos, tiempoMes) {
        const { minutosJornada, minutosMediaJornada } = this.config
        const minutosATrabajar = minutosJornada * datos.total + minutosMediaJornada * datos.totalMedios
        const minutosRestantes = tiempoMes.horas * 60 + tiempoMes.minutos - minutosATrabajar
        const colorRestantes = minutosRestantes < 0 ? 'naranja' : 'turquesa'
        const textoRestantes = minutosRestantes < 0 ? 'restantes' : 'de más'
        const textoBotonEnviar = 'Mostrar/Ocultar botón de enviar'

        const handleAlternarBoton = () => {
            this.alternarBotonEnviar()
        }

        return TimesheetPlus.html`
            <div id="mes">
                <div style="height:10px"></div>
                <div class="titulo1 d-flex jc-sb">
                    <div class="i">Este mes</div>
                    <div class="pntr azul" title="${textoBotonEnviar}" @click=${handleAlternarBoton}>&#9993; &nbsp;</div>
                </div>
                <div class="contenido1">
                    <div class=" ">
                        <span class="b rojo"> ${datos.notrabajo} </span> días no laborables
                        <br>
                        <span class="b"> ${datos.totalMedios} </span> &#189; días laborables
                        <br>
                        <span class="b"> ${datos.total} </span> días laborables
                    </div>
                    <div class=" ">
                        <span class="verde b"> ${this.renderMinutos(tiempoMes.horas * 60 + tiempoMes.minutos)}</span>
                        <span class=""> de </span>
                        <span class="b"> ${this.renderMinutos(minutosATrabajar)}</span>
                        <span class="gris fs80">
                            ${datos.total} x ${this.renderMinutos(minutosJornada)} +
                            ${datos.totalMedios} x ${this.renderMinutos(minutosMediaJornada)}
                        </span>
                    </div>
                    <div class=" ">
                        <span class="${colorRestantes} b"> ${this.renderMinutos(minutosRestantes, true)}</span> ${textoRestantes}
                    </div>
                </div>
            </div>
        `
    }

    renderConfiguracionHTML() {
        const inicio = parseInt(this.storageGet('hora-inicio')) || 8
        const comida = parseInt(this.storageGet('hora-comida')) || 14
        const duracionComida = parseInt(this.storageGet('duracion-comida')) || 20
        const textoBotonAleatorio = "Registrar tiempos aleatoriamente en el actual día expandido"

        const handleAleatorio = async () => {
            const titulosDias = this.obtenerMain().querySelectorAll(this.SELECTORES.titulosDias)
            const diaExpandido = Array.from(titulosDias).find(
                tituloDia => this.estaExpandido(tituloDia)
            )
            if (diaExpandido) {
                await this.renderDiaAleatorio(diaExpandido)
            }
        }

        const handleHoraInicio = (e) => {
            this.storageSet('hora-inicio', e.target.value)
        }

        const handleHoraComida = (e) => {
            this.storageSet('hora-comida', e.target.value)
        }

        const handleMinutosComida = (e) => {
            this.storageSet('duracion-comida', e.target.value)
        }

        return TimesheetPlus.html`
            <div id="configuracion">
                <div style="height:10px"></div>
                <div class="titulo1 d-flex">
                    <div class="i">Configuración día aleatorio</div>
                    <div class="flex"></div>
                    <div class="pntr azul" title="${textoBotonAleatorio}" @click=${handleAleatorio}>&#9860; &nbsp;</div>
                </div>
                <div class="contenido1">
                    <div class="d-flex ai-c">
                        <div class="gris" style="width:9em">&#9857; Hora inicio</div>
                        <div class="flex">
                            <input class="texto" type="number" value="${inicio}" placeholder="8" @change=${handleHoraInicio}>
                        </div>
                    </div>
                    <div class="d-flex ai-c">
                        <div class="gris" style="width:9em">&#9859; Hora comida</div>
                        <div class="flex">
                            <input class="texto" type="number" value="${comida}" placeholder="14" @change=${handleHoraComida}>
                        </div>
                    </div>
                    <div class="d-flex ai-c">
                        <div class="gris" style="width:9em">&#9858; Minutos comida</div>
                        <div class="flex">
                            <input class="texto" type="number" value="${duracionComida}" placeholder="20" @change=${handleMinutosComida}>
                        </div>
                    </div>
                </div>
            </div>
        `
    }

    renderMinutosMesesHTML() {
        const claves = Object.keys(localStorage)
        const dataMeses = claves.filter(k => k.startsWith('timesheetplus-restantes'))
            .map(k => k.replace('timesheetplus-', ''))
            .map(k => this.storageGet(k))
        dataMeses.sort((a, b) => a.month - b.month)

        // Renderizar cada mes con eventos
        const renderMesElement = (datosMes) => {
            const clave = `restantes-${datosMes.month}-${datosMes.year}`
            
            const handleEliminar = async () => {
                this.storageRemove(clave)
                await this.actualizar()
            }
            
            return TimesheetPlus.html`
                <div class="d-flex">
                    <div>
                        ${this.config.meses[datosMes.month - 1]} ${datosMes.year}: 
                        <span class="${datosMes.minutosRestantes < 0 ? 'naranja' : 'turquesa'}">
                            ${this.renderMinutos(datosMes.minutosRestantes, true)}
                        </span>
                    </div>
                    <div class="flex"></div>
                    <div 
                        class="delete rojo i fs80 pntr usn" 
                        @click=${handleEliminar}
                    >
                        delete
                    </div>
                </div>
            `
        }

        const minutosAno = dataMeses.reduce((acc, m) => acc + m.minutosRestantes, 0)

        // Generar array de elementos para cada mes
        const elementosMeses = dataMeses.map(renderMesElement)

        return TimesheetPlus.html`
            <div id="minutosMeses">
                <div style="height:10px"></div>
                <div class="titulo1 d-flex">
                    <div class="i">Minutos restantes total</div>
                </div>
                <div>
                    Total: <span class="${minutosAno < 0 ? 'naranja' : 'turquesa'}">
                        ${this.renderMinutos(minutosAno, true)}
                    </span>
                </div>
                <div class="titulo1 d-flex">
                    <div class="i">Minutos restantes por mes</div>
                </div>
                <div>
                    ${elementosMeses}
                </div>
            </div>
        `
    }

    renderBotonInicio() {
        const handleClick = async () => {
            this.mostrarDia()
            const tituloDia = this.obtenerDiaHoy()
            const contenedorDia = tituloDia.parentNode
            await this.agregarNuevoEditorInicioFin()
            const editoresInicioFin = contenedorDia.querySelectorAll(this.SELECTORES.editoresInicioFin)
            const ultimoEditor = editoresInicioFin[editoresInicioFin.length - 1]
            const entradas = ultimoEditor.querySelectorAll(this.SELECTORES.inputTiempo)
            const entradaInicio = entradas[0]
            const entradaFin = entradas[1]
            const ahora = new Date()
            const fechaInicio = this.ajustarHoraFichaje(ahora, true)
            const fechaFin = new Date(fechaInicio.getTime() + this.DURACION_ENTRADA_INICIAL)

            await this.establecerHoraInput(entradaInicio, fechaInicio)
            await this.establecerHoraInput(entradaFin, fechaFin)
            await this.guardarDia()
        }

        return TimesheetPlus.html`
            <div 
                id="botonInicio" 
                class="boton boton-azul" 
                style="margin-right: 5px"
                @click=${handleClick}
            >
                <div>Inicio</div>
            </div>
        `
    }

    renderBotonFin() {
        const handleClick = async () => {
            await this.actualizarUltimaHora()
            await this.guardarDia()
        }

        return TimesheetPlus.html`
            <div 
                id="botonFin" 
                class="boton boton-rojo" 
                style="margin-right: 5px"
                @click=${handleClick}
            >
                <div>Fin</div>
            </div>
        `
    }

    renderBotonAuto() {
        const handleClick = async () => {
            await this.renderDiaAleatorio()
        }

        return TimesheetPlus.html`
            <div 
                id="botonAuto" 
                class="boton boton-azul2" 
                style="margin-right: 5px"
                @click=${handleClick}
            >
                <div>Auto</div>
            </div>
        `
    }

    renderBotonMesAuto() {
        const handleClick = async () => {
            if (confirm('Se llenarán automaticamente todos los días sin rellenar')) {
                const titulosDias = this.obtenerMain().querySelectorAll(this.SELECTORES.titulosDias)
                for (const tituloDia of titulosDias) {
                    const indicadoresDia = tituloDia.querySelector(this.SELECTORES.indicadoresDia)
                    if (this.esDiaDeTrabajo(indicadoresDia)) {
                        this.mostrarDia(tituloDia)
                        if (!this.tieneEditoresInicioFin(tituloDia)) {
                            await this.renderDiaAleatorio(tituloDia)
                        }
                    }
                }
            }
        }

        return TimesheetPlus.html`
            <div 
                id="mesAuto" 
                class="boton boton-rojo2" 
                style="margin-right: 5px"
                @click=${handleClick}
            >
            <div>Mes auto</div>
            </div>
        `
    }


    /**
     * Renderiza horas en formato "Xh Ym"
     */
    renderMinutos(minutos, usarSigno = false) {
        const signo = usarSigno ? (minutos >= 0 ? '+' : '-') : ''
        const horas = Math.abs(Math.trunc(minutos / 60))
        const minutosRestantes = Math.abs(minutos % 60)
        return `${signo} ${horas}h ${minutosRestantes}m`
    }

    /**
     * Calcula y renderiza hora de salida recomendada para hoy
     */
    obtenerHoraSalidaHoy(minutos) {
        const ahora = new Date()
        ahora.setTime(ahora.getTime() + minutos * 60000)
        const horas = String(ahora.getHours()).padStart(2, '0')
        const minutosFormateados = String(ahora.getMinutes()).padStart(2, '0')
        return `${horas}:${minutosFormateados}`
    }

    /**
     * Ajusta el tiempo de fichaje al múltiplo de 5 minutos más cercano
     */
    ajustarHoraFichaje(fecha, esEntrada = true) {
        fecha = new Date(fecha)

        const redondear = esEntrada ? Math.floor : Math.ceil
        const nuevosMinutos = redondear(fecha.getMinutes() / 5) * 5

        if (nuevosMinutos === 60) {
            fecha.setHours(fecha.getHours() + 1)
            fecha.setMinutes(0)
        } else {
            fecha.setMinutes(nuevosMinutos)
        }

        return fecha
    }

    /**
     * Guarda los minutos restantes del mes en localStorage
     */
    guardarMinutosRestantes(datos) {
        const tiempoMes = this.estado.tiempoTrabajadoMes
        const { minutosJornada, minutosMediaJornada } = this.config

        const minutosATrabajar = minutosJornada * datos.total + minutosMediaJornada * datos.totalMedios
        const minutosRestantes = tiempoMes.totalMinutos - minutosATrabajar

        const { month, year } = this.obtenerFechaHoja()
        this.storageSet(`restantes-${month}-${year}`, { month, year, minutosRestantes })
    }

    /**
     * Deshabilita la interacción del usuario (userSelect y pointerEvents)
     * @returns {Object} Estilos originales para poder restaurarlos después
     */
    deshabilitarInteraccionUsuario() {
        const contenedorTimesheet = this.obtenerMain()
        const estilosOriginales = {
            userSelect: contenedorTimesheet.style.userSelect,
            pointerEvents: contenedorTimesheet.style.pointerEvents
        }
        contenedorTimesheet.style.userSelect = 'none'
        contenedorTimesheet.style.pointerEvents = 'none'
        return estilosOriginales
    }

    /**
     * Restaura la interacción del usuario (userSelect y pointerEvents)
     * @param {Object} estilosOriginales - Estilos originales a restaurar
     */
    restaurarInteraccionUsuario(estilosOriginales) {
        const contenedorTimesheet = this.obtenerMain()
        contenedorTimesheet.style.userSelect = estilosOriginales.userSelect
        contenedorTimesheet.style.pointerEvents = estilosOriginales.pointerEvents
    }

    // ============================================================================
    // USER ACTIONS - Handlers de acciones del usuario
    // ============================================================================

    /**
     * Actualiza la hora de fin del último registro al momento actual
     */
    async actualizarUltimaHora() {
        this.mostrarDia()
        const tituloDia = this.obtenerDiaHoy()
        const contenedorDia = tituloDia.parentNode
        const editoresInicioFin = contenedorDia.querySelectorAll(this.SELECTORES.editoresInicioFin)
        const ultimoEditor = editoresInicioFin[editoresInicioFin.length - 1]
        const entradas = ultimoEditor.querySelectorAll(this.SELECTORES.inputTiempo)
        const entradaFin = entradas[1]
        const fechaFin = this.ajustarHoraFichaje(Date.now(), false)
        await this.establecerHoraInput(entradaFin, fechaFin)
        this.guardarDia()
    }

    /**
     * Muestra (scroll + expand) un día específico del timesheet
     */
    mostrarDia(tituloDia) {
        tituloDia = tituloDia ?? this.obtenerDiaHoy()
        
        if (tituloDia) {
            const contenedorDia = tituloDia.parentNode
            const rectDia = contenedorDia.getBoundingClientRect()
            document.body.scrollTo(0, rectDia.top + document.body.scrollTop - this.OFFSET_SCROLL_DIA)
            const estaExpandido = this.estaExpandido(tituloDia)
            if (!estaExpandido) {
                tituloDia.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
            }
        }
    }

    /**
     * Rellena un día con tiempos aleatorios basados en configuración
     */
    async renderDiaAleatorio(tituloDia) {
        tituloDia = tituloDia ?? this.obtenerDiaHoy()
        
        if (tituloDia) {
            this.mostrarDia(tituloDia)
            await this.eliminarTodosLosEditores(tituloDia)
            const contenedorDia = tituloDia.parentNode
            let editoresInicioFin = contenedorDia.querySelectorAll(this.SELECTORES.editoresInicioFin)
            const primerEditor = editoresInicioFin[0]
            let entradas = primerEditor.querySelectorAll(this.SELECTORES.inputTiempo)
            let entradaInicio = entradas[0]
            let entradaFin = entradas[1]

            const inicio1 = new Date()

            // Obtener configuración de horarios
            const inicio = parseInt(this.storageGet('hora-inicio')) || 8
            const comida = parseInt(this.storageGet('hora-comida')) || 14
            const duracionComida = parseInt(this.storageGet('duracion-comida')) || 20

            // Primera entrada (mañana)
            const minutoInicio = this.enteroAleatorio(0, 15)
            inicio1.setHours(inicio)
            inicio1.setMinutes(minutoInicio)

            const minutosHastaComida = (comida - inicio) * 60
            const minutosTrabajadosManana = this.enteroAleatorio(this.enteroAleatorio(minutosHastaComida - 30, minutosHastaComida), this.enteroAleatorio(minutosHastaComida, minutosHastaComida + 30))
            const fin1 = new Date(inicio1.getTime() + (minutosTrabajadosManana * 60000))

            const fechaInicio1 = this.ajustarHoraFichaje(inicio1, false)
            const fechaFin1 = this.ajustarHoraFichaje(fin1, false)

            await this.establecerHoraInput(entradaInicio, fechaInicio1)
            await this.establecerHoraInput(entradaFin, fechaFin1)

            // Segunda entrada (tarde)
            await this.agregarNuevoEditorInicioFin(tituloDia)
            editoresInicioFin = contenedorDia.querySelectorAll(this.SELECTORES.editoresInicioFin)
            const ultimoEditor = editoresInicioFin[editoresInicioFin.length - 1]
            entradas = ultimoEditor.querySelectorAll(this.SELECTORES.inputTiempo)
            entradaInicio = entradas[0]
            entradaFin = entradas[1]

            const duracionComidaAleatoria = this.enteroAleatorio(duracionComida - 5, duracionComida + 5)
            const inicio2 = new Date(fin1.getTime() + (duracionComidaAleatoria * 60000))
            const minutosTarde = this.config.minutosJornada - minutosTrabajadosManana
            const fin2 = new Date(inicio2.getTime() + ((minutosTarde + this.enteroAleatorio(-5, 10)) * 60000))

            const fechaInicio2 = this.ajustarHoraFichaje(inicio2, false)
            const fechaFin2 = this.ajustarHoraFichaje(fin2, false)

            await this.establecerHoraInput(entradaInicio, fechaInicio2)
            await this.establecerHoraInput(entradaFin, fechaFin2)

            await this.guardarDia(tituloDia)
        }
    }

    /**
     * Establece el tiempo en un input de tiempo del timesheet
     */
    async establecerHoraInput(entradaTiempo, ahora) {
        const horas = ahora.getHours()
        const minutos = ahora.getMinutes()

        const entradaHoras = entradaTiempo.querySelector(this.SELECTORES.inputHoras)
        const entradaMinutos = entradaTiempo.querySelector(this.SELECTORES.inputMinutos)
        
        const flechaArriba = entradaTiempo.querySelector(this.SELECTORES.flechaArriba)
        
        entradaHoras.dispatchEvent(new Event('focus', { bubbles: true }))
        await new Promise(r => setTimeout(r, this.DELAY_ESPERA_CORTO))
        entradaHoras.dispatchEvent(new Event('click', { bubbles: true }))
        await new Promise(r => setTimeout(r, this.DELAY_ESPERA_CORTO))
        
        while (true) {
            const actual = entradaHoras.innerText
            if (parseInt(actual) === horas) {
                break
            } else {
                flechaArriba.dispatchEvent(new Event('click', { bubbles: true }))
                await new Promise(r => setTimeout(r, this.DELAY_ESPERA_CLICK))
            }
        }
        
        entradaMinutos.dispatchEvent(new Event('focus', { bubbles: true }))
        await new Promise(r => setTimeout(r, this.DELAY_ESPERA_CORTO))
        entradaMinutos.dispatchEvent(new Event('click', { bubbles: true }))
        await new Promise(r => setTimeout(r, this.DELAY_ESPERA_CORTO))
        
        while (true) {
            const actual = entradaMinutos.innerText
            if (parseInt(actual) === minutos) {
                break
            } else {
                flechaArriba.dispatchEvent(new Event('click', { bubbles: true }))
                await new Promise(r => setTimeout(r, this.DELAY_ESPERA_CLICK))
            }
        }
    }

    /**
     * Guarda un día (colapsar y expandir para forzar guardado)
     */
    async guardarDia(tituloDia) {
        tituloDia = tituloDia ?? this.obtenerDiaHoy()
        
        const estaExpandido = this.estaExpandido(tituloDia)
        if (estaExpandido) {
            await new Promise(r => setTimeout(r, this.DELAY_GUARDAR))
            tituloDia.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        }
        await new Promise(r => setTimeout(r, this.DELAY_GUARDAR))
        tituloDia.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        await new Promise(r => setTimeout(r, this.DELAY_GUARDAR))
    }

    /**
     * Añade un nuevo editor de hora inicio-fin a un día
     */
    async agregarNuevoEditorInicioFin(tituloDia) {
        tituloDia = tituloDia ?? this.obtenerDiaHoy()
        
        const contenedorDia = tituloDia.parentNode
        const editoresInicioFin = contenedorDia.querySelectorAll(this.SELECTORES.editoresInicioFin)
        const ultimoEditor = editoresInicioFin[editoresInicioFin.length - 1]
        const botonAgregar = ultimoEditor.querySelector(this.SELECTORES.botonAgregar)
        
        botonAgregar.dispatchEvent(new Event('click', { bubbles: true }))
        await new Promise(r => setTimeout(r, this.DELAY_ESPERA_CORTO))
    }

    /**
     * Verifica si un día tiene editores de hora inicio-fin con datos
     */
    tieneEditoresInicioFin(tituloDia) {
        tituloDia = tituloDia ?? this.obtenerDiaHoy()
        
        const contenedorDia = tituloDia.parentNode
        const editoresInicioFin = contenedorDia.querySelectorAll(this.SELECTORES.editoresInicioFin)
        if (editoresInicioFin.length === 1) {
            const ultimoEditor = editoresInicioFin[editoresInicioFin.length - 1]
            const entradas = ultimoEditor.querySelectorAll(this.SELECTORES.inputTiempo)
            const entradaInicio = entradas[0]
            const entradaHoras = entradaInicio.querySelector(this.SELECTORES.inputHoras)
            const entradaMinutos = entradaInicio.querySelector(this.SELECTORES.inputMinutos)
            const horas = parseInt(entradaHoras.innerText)
            const minutos = parseInt(entradaMinutos.innerText)
            return !isNaN(horas) && !isNaN(minutos)
        }
        return true
    }

    /**
     * Elimina todos los editores de hora excepto el primero
     */
    async eliminarTodosLosEditores(tituloDia) {
        tituloDia = tituloDia ?? this.obtenerDiaHoy()
        
        const contenedorDia = tituloDia.parentNode
        const editoresInicioFin = Array.from(contenedorDia.querySelectorAll(this.SELECTORES.editoresInicioFin))
        
        // Eliminar desde el último hasta el segundo (índice 1), dejando el primero (índice 0)
        for (let i = editoresInicioFin.length - 1; i > 0; i--) {
            const botonEliminar = editoresInicioFin[i].querySelector(this.SELECTORES.botonEliminar)
            botonEliminar.dispatchEvent(new Event('click', { bubbles: true }))
            await new Promise(r => setTimeout(r, this.DELAY_ESPERA_CORTO))
        }
    }

    /**
     * Oculta el botón de enviar del timesheet original
     */
    desactivarBotonEnviar() {
        const botonEnviar = document.querySelector(this.SELECTORES.botonEnviar)
        if (botonEnviar) {
            botonEnviar.style.pointerEvents = 'none'
            botonEnviar.style.display = 'none'
        }
    }

    /**
     * Alterna la visibilidad del botón de enviar
     */
    alternarBotonEnviar() {
        const botonEnviar = document.querySelector(this.SELECTORES.botonEnviar)
        if (botonEnviar) {
            if (botonEnviar.style.display === 'none') {
                botonEnviar.style.pointerEvents = ''
                botonEnviar.style.display = ''
            } else {
                botonEnviar.style.pointerEvents = 'none'
                botonEnviar.style.display = 'none'
            }
        }
    }

    // ============================================================================
    // STORAGE - Persistencia en localStorage
    // ============================================================================

    /**
     * Guarda un valor en localStorage con prefijo timesheetplus-
     */
    storageSet(key, value) {
        if (value != null) {
            localStorage.setItem(`timesheetplus-${key}`, JSON.stringify(value))
        }
    }

    /**
     * Obtiene un valor de localStorage
     */
    storageGet(key) {
        return JSON.parse(localStorage.getItem(`timesheetplus-${key}`))
    }

    /**
     * Elimina un valor de localStorage
     */
    storageRemove(key) {
        localStorage.removeItem(`timesheetplus-${key}`)
    }

    // ============================================================================
    // UTILITIES - Funciones auxiliares
    // ============================================================================

    /**
     * Genera un número aleatorio entre min y max (incluidos)
     */
    enteroAleatorio(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min)
    }

    // ============================================================================
    // TEMPLATE HELPERS - Funciones auxiliares para templates
    // ============================================================================

    /**
     * Helper para template literals de CSS (estilo Lit)
     */
    static css(strings, ...values) {
        return strings.reduce((result, str, i) => {
            return result + str + (values[i] || '')
        }, '')
    }

    /**
     * Helper para template literals de HTML (estilo Lit)
     */
    static html(strings, ...values) {
        // Combinar strings y values
        const htmlString = strings.reduce((result, str, i) => {
            const valor = values[i]
            let valorProcesado = ''

            // Si el valor es una función, guardarlo para procesamiento posterior
            if (typeof valor === 'function') {
                const handlerId = `__handler_${i}__`
                valorProcesado = handlerId
            } else if (valor instanceof Element) {
                // Marcar elementos DOM para inserción posterior
                const elementId = `__element_${i}__`
                valorProcesado = `<span data-element-placeholder="${elementId}"></span>`
            } else if (Array.isArray(valor)) {
                // Soportar arrays de elementos (para listas dinámicas)
                const arrayId = `__array_${i}__`
                valorProcesado = `<span data-array-placeholder="${arrayId}"></span>`
            } else if (valor != null) {
                valorProcesado = valor
            }

            return result + str + valorProcesado
        }, '')

        // Crear un contenedor temporal
        const plantilla = document.createElement('template')
        plantilla.innerHTML = htmlString.trim()

        // Procesar eventos @click, @input, etc. y elementos DOM interpolados
        const procesarNodo = (elemento) => {
            // Procesar atributos del elemento actual
            if (elemento.attributes) {
                Array.from(elemento.attributes).forEach(atributo => {
                    // Procesar eventos @evento
                    if (atributo.name.startsWith('@')) {
                        const nombreEvento = atributo.name.substring(1)
                        const valorManejador = atributo.value

                        const coincidenciaManejador = valorManejador.match(/__handler_(\d+)__/)
                        if (coincidenciaManejador) {
                            const indiceManejador = parseInt(coincidenciaManejador[1])
                            const manejador = values[indiceManejador]

                            if (typeof manejador === 'function') {
                                elemento.addEventListener(nombreEvento, manejador)
                            }
                        }

                        elemento.removeAttribute(atributo.name)
                    }

                    // Procesar placeholders de elementos DOM
                    if (atributo.name === 'data-element-placeholder') {
                        const coincidenciaElemento = atributo.value.match(/__element_(\d+)__/)
                        if (coincidenciaElemento) {
                            const indiceElemento = parseInt(coincidenciaElemento[1])
                            const elementoDOM = values[indiceElemento]

                            if (elementoDOM instanceof Element) {
                                elemento.parentNode.replaceChild(elementoDOM, elemento)
                            }
                        }
                    }

                    // Procesar placeholders de arrays
                    if (atributo.name === 'data-array-placeholder') {
                        const coincidenciaArray = atributo.value.match(/__array_(\d+)__/)
                        if (coincidenciaArray) {
                            const indiceArray = parseInt(coincidenciaArray[1])
                            const arreglo = values[indiceArray]

                            if (Array.isArray(arreglo)) {
                                const fragmento = document.createDocumentFragment()
                                arreglo.forEach(item => {
                                    if (item instanceof Element) {
                                        fragmento.appendChild(item)
                                    } else if (typeof item === 'string') {
                                        const divTemporal = document.createElement('div')
                                        divTemporal.innerHTML = item
                                        while (divTemporal.firstChild) {
                                            fragmento.appendChild(divTemporal.firstChild)
                                        }
                                    }
                                })
                                elemento.parentNode.replaceChild(fragmento, elemento)
                            }
                        }
                    }
                })
            }

            // Procesar hijos recursivamente
            Array.from(elemento.children).forEach(hijo => procesarNodo(hijo))
        }

        const contenido = plantilla.content.firstChild
        if (contenido) {
            procesarNodo(contenido)
        }

        return contenido
    }

    // ============================================================================
    // STYLES - Estilos del componente
    // ============================================================================

    static styles = TimesheetPlus.css`
        .full { position: relative; width: 100%; height: 100%; display: block; }
        .flex { flex: 1; flex-basis: 0.000000001px; }
        .d-flex { display: flex; overflow-wrap:break-word; }
        .d-iflex { display: inline-flex; }
        .fd-c { flex-direction: column; }
        .fd-rr { flex-direction: row-reverse; }
        .fd-cr { flex-direction: column-reverse; }
        .fw-w { flex-wrap: wrap }
        .fw-wr { flex-wrap: wrap-reverse }
        .jc-fe { justify-content: flex-end; }
        .jc-c { justify-content: center; }
        .jc-sb { justify-content: space-between; }
        .jc-sa { justify-content: space-around; }
        .jc-se { justify-content: space-evenly; }
        .ai-s{ align-items: stretch; }
        .ai-c{ align-items: center; }
        .ai-fs{ align-items: flex-start; }
        .ai-fe{ align-items: flex-end; }
        .ai-b{ align-items: baseline; }
        .ac-fs{ align-content: flex-start; }
        .ac-fe{ align-content:flex-end; }
        .ac-c{ align-content: center; }
        .ac-sb{ align-content: space-between; }
        .ac-sa{ align-content: space-around; }

        /* Break word fix */
        .d-flex > * { min-width: 0px; min-height:0px; }

        #TimesheetPlus {
            position: fixed;
            right:40px;
            background-color: #fafafa;
            border-radius: 3px;
            padding: 20px;
            z-index:1000;
            height:650px;
            margin-top:auto;
            margin-bottom:auto;
            overflow-y:auto;
        }
        .acumulado-por-dia {
            position:absolute;
            bottom:-3px;
            right:7px;
        }

        .pntr{
            cursor: pointer;
        }
        .usn{
            user-select: none;
        }
        .boton{
            display: flex;
            justify-content: center;
            align-items: center;
            min-width :80px;
            height :25px;
            cursor :pointer;
            color :white;
            text-align :center;
            padding :9px 0;
            border-radius: 3px;
        }
        #botonAuto{
            width :75px;
        }
        .boton-rojo{
            background-color :#CC3333;
        }
        .boton-rojo2{
            background-color :#dc143c;
        }
        .boton-azul{
            background-color :#003e63;
        }
        .boton-azul2{
            background-color :#1e88e5;
        }

        .hr{
            height:1px;
            background-color:lightgray;
            margin:10px 0
        }
        .br{
            height:1px;
            background-color:transparent;
            margin:10px 0
        }

        .b{
            font-weight: bold;
        }
        .i{
            font-style: italic;
        }

        .gris{
            color:gray;
        }
        .azul{
            color:#039BE5;
        }
        .verde{
            color:#2aa22e;
        }
        .morado{
            color:#903b9f;
        }
        .rojo{
            color:#CC3333;
        }
        .naranja{
            color:#FF6600;
        }
        .turquesa{
            color:#1797b4;
        }

        .titulo1{
            padding:3px 5px;
            background-color: #f0f0f0;
            border-radius: 3px;
            font-size: 1.05em;
        }
        .contenido1{
            padding:3px 6px;
        }

        .shadow1{
            box-shadow: rgba(0, 0, 0, 0.24) 0px 3px 8px;
        }

        .fs120{
            font-size: 1.2em;
        }
        .fs110{
            font-size: 1.1em;
        }
        .fs100{
            font-size: 1em;
        }
        .fs90{
            font-size: 0.9em;
        }
        .fs80{
            font-size: 0.8em;
        }
        .fs70{
            font-size: 0.7em;
        }
        .fs60{
            font-size: 0.6em;
        }
        .fs50{
            font-size: 0.5em;
        }
        input.texto{
            border-radius: 2px;
            background-color: white;
            border: 1px solid #ddd;
            outline: 0;
            box-shadow: inset 0 1px 2px rgba(27, 31, 35, .075);
            transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s;
            width: 100%;
            height: 26px;
            line-height: calc(18px + 1em);
            padding-left: 1em;
            padding-right: 0em;
            color: #444;
            margin: 2px;
        }
        input.texto:focus {
            border-color: #2188ff !important;
            box-shadow: rgba(27, 31, 35, 0.075) 0px 1px 2px 0px inset, rgba(3, 102, 214, 0.3) 0px 0px 0px 2.8px !important;
        }
        input.texto:focus:invalid {
            border-color: #ff2121 !important;
            box-shadow: rgba(27, 31, 35, 0.075) 0px 1px 2px 0px inset, rgba(214, 3, 3, 0.3) 0px 0px 0px 2.8px !important;
        }
    `
}

new TimesheetPlus()
