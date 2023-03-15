class TimesheetPlus {
    constructor() {
        this.addStyle()
        this.indicadoresNoTrabajo = [
            'indicator-holiday',
            'indicator-vacation-pending',
            'indicator-vacation-approved',
            'indicator-absence-pending',
            'indicator-absence-approved',
        ]
        this.meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
        this.minutosJornada = (7 * 60) + 45
        this.minutosMediaJornada = (4 * 60)
        setInterval(async () => {
            const headerRow = document.querySelector('.wx-timesheet__header')
            if (headerRow != null) {
                const left = headerRow.querySelector('#TimesheetPlus')
                if (left == null) {
                    await this.init()
                }
            }
        }, 4000)
    }
    storageSet(key, value) {
        if (value != null) {
            localStorage.setItem(`timesheetplus-${key}`, JSON.stringify(value))
        }
    }
    storageGet(key) {
        return JSON.parse(localStorage.getItem(`timesheetplus-${key}`))
    }
    getMain() {
        return document.querySelector('.wx-timesheet__main-body')
    }
    async init() {
        await new Promise(r => setTimeout(r, 2000))
        clearInterval(this.repetirInterval)
        clearInterval(this.keepAliveInterval)
        const left = document.createElement('div')
        left.setAttribute('id', 'TimesheetPlus')
        left.classList.add('shadow1')
        left.classList.add('fs110')

        const bar = document.createElement('div')
        bar.classList.add('d-flex', 'ai-c', 'jc-c')
        left.appendChild(bar)

        const nuevoIntervalo = this.crearBotonInicio()
        bar.appendChild(nuevoIntervalo)
        const actualizarUltimoFinBtn = this.crearBotonFin()
        bar.appendChild(actualizarUltimoFinBtn)

        // const clockEl = this.createSVGClock()
        // bar.appendChild(clockEl)

        const headerRow = document.querySelector('.wx-timesheet__header')
        headerRow.appendChild(left)

        ////
        const repetir = async () => {
            const data = await this.getDiasTrabajoMes()
            this.renderHoy(left, data)
            await this.renderMesHastaHoy(left, data)
            await this.renderMes(left, data)
            await this.renderAccumulatedTimePerDay()
            this.renderConfiguracion(left)
        }
        const keepAlive = async () => {
            const res = await fetch(window.location.href)
            // const text = await res.text()
            // console.log(text)
        }
        await repetir()
        this.repetirInterval = setInterval(repetir, 5000)

        this.keepAliveInterval = setInterval(keepAlive, 60000 * 15)

        await new Promise(r => setTimeout(r, 1000))
        this.desactivarBotonEnviar()
    }

    crearBotonInicio() {
        const button = document.createElement('div')
        button.setAttribute('id', 'botonInicio')
        button.style.marginRight = '5px'
        button.classList.add('boton', 'boton-azul')
        button.innerHTML = `
            <div style="padding:0 10px 3px 0" class="fs120"> &plus; </div>
            <div> Inicio </div>
        `
        button.addEventListener('click', async () => {
            this.mostrarDia()
            const dayTitle = this.getMain().querySelector(this.getSelectorHoy())
            const day = dayTitle.parentNode
            await this.addNewStartEndEditor()
            const startEndEditors = day.querySelectorAll('timesheet-start-end-editor')
            const lastEditor = startEndEditors[startEndEditors.length - 1]
            const inputs = lastEditor.querySelectorAll('.wx-time-input')
            const startInput = inputs[0]
            const endInput = inputs[1]
            const now = new Date()
            const startDate = this.adjustClockinTime(now, true)
            const endDate = new Date(startDate.getTime() + 5 * 60000)

            await this.setInputTime(startInput, startDate)
            await this.setInputTime(endInput, endDate)
            await this.saveDay()
        })
        return button
    }

    crearBotonFin() {
        const button = document.createElement('div')
        button.setAttribute('id', 'botonFin')
        button.style.marginRight = '5px'
        button.classList.add('boton', 'boton-rojo')
        button.innerHTML = `
            <div style="padding:0 10px 0 0"> &#128472; </div>
            <div> Fin </div>
        `
        button.addEventListener('click', async () => {
            await this.actualizarUltimaHora()
            await this.saveDay()
        })
        return button
    }

    async setInputTime(timeInput, now) {
        const hours = now.getHours()
        const minutes = now.getMinutes()

        const startHoursInput = timeInput.querySelector('.wx-time-input__hours')
        const startMinutesInput = timeInput.querySelector('.wx-time-input__minutes')

        const upStartArrow = timeInput.querySelector('.wx-time-input__up-arrow')
        const downStartArrow = timeInput.querySelector('.wx-time-input__down-arrow')

        startHoursInput.dispatchEvent(new Event('focus', { bubbles: true }))
        await new Promise(r => setTimeout(r, 100))
        startHoursInput.dispatchEvent(new Event('click', { bubbles: true }))
        await new Promise(r => setTimeout(r, 100))

        while (true) {
            let current = startHoursInput.innerText
            if (parseInt(current) === parseInt(hours)) {
                break
            } else {
                upStartArrow.dispatchEvent(new Event('click', { bubbles: true }))
                await new Promise(r => setTimeout(r, 20))
            }
        }

        startMinutesInput.dispatchEvent(new Event('focus', { bubbles: true }))
        await new Promise(r => setTimeout(r, 100))
        startMinutesInput.dispatchEvent(new Event('click', { bubbles: true }))
        await new Promise(r => setTimeout(r, 100))


        while (true) {
            let current = startMinutesInput.innerText
            if (parseInt(current) === parseInt(minutes)) {
                break
            } else {
                upStartArrow.dispatchEvent(new Event('click', { bubbles: true }))
                await new Promise(r => setTimeout(r, 20))
            }
        }
    }

    getInputValue(timeInput, date) {
        const startHoursInput = timeInput.querySelector('.wx-time-input__hours')
        const startMinutesInput = timeInput.querySelector('.wx-time-input__minutes')
        const hours = parseInt(startHoursInput.innerText)
        const minutes = parseInt(startMinutesInput.innerText)

        if (!isNaN(hours) && !isNaN(minutes)) {
            date = new Date(date)
            date.setHours(hours)
            date.setMinutes(minutes)
        } else {
            date = null
        }
        return { hours: hours, minutes: minutes, date: date }
    }


    async saveDay() {
        const dayTitle = this.getMain().querySelector(this.getSelectorHoy())
        let isExpanded = dayTitle.getAttribute('aria-expanded') === 'true'
        if (isExpanded) {
            await new Promise(r => setTimeout(r, 10))
            dayTitle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        }
        await new Promise(r => setTimeout(r, 10))
        dayTitle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        await new Promise(r => setTimeout(r, 10))
    }

    async addNewStartEndEditor(dayTitle) {
        if (dayTitle == null) {
            dayTitle = this.getMain().querySelector(this.getSelectorHoy())
        }
        const day = dayTitle.parentNode
        const startEndEditors = day.querySelectorAll('timesheet-start-end-editor')
        const lastEditor = startEndEditors[startEndEditors.length - 1]
        const addButton = lastEditor.querySelector(`button[aria-label="Add"]`)

        addButton.dispatchEvent(new Event('click', { bubbles: true }))
        await new Promise(r => setTimeout(r, 100))
    }
    async eliminarTodosLosEditores(dayTitle) {
        if (dayTitle == null) {
            dayTitle = this.getMain().querySelector(this.getSelectorHoy())
        }
        const day = dayTitle.parentNode
        const startEndEditors = day.querySelectorAll('timesheet-start-end-editor')
        for (let i = startEndEditors.length - 1; i > 0; i--) {
            const lastEditor = startEndEditors[i]
            const deleteButton = lastEditor.querySelector(`button[aria-label="Delete"]`)
            deleteButton.dispatchEvent(new Event('click', { bubbles: true }))
            await new Promise(r => setTimeout(r, 100))
        }
    }

    adjustClockinTime(date, is_clockin = true) {
        date = new Date(date)

        let new_minutes
        if (is_clockin) {
            // date.getTime() + minutes*60000
            new_minutes = Math.floor(date.getMinutes() / 5) * 5
        } else {
            new_minutes = Math.ceil(date.getMinutes() / 5) * 5
        }

        if (new_minutes == 60) {
            date.setHours(date.getHours() + 1)
            date.setMinutes(0)
        } else {
            date.setMinutes(new_minutes)
        }

        return date
    }
    desactivarBotonEnviar() {
        const botonEnviar = document.querySelector('#timesheet-action-button-submit')
        if (botonEnviar != null) {
            botonEnviar.style.pointerEvents = 'none'
            botonEnviar.style.display = 'none'
        }
    }
    alternarBotonEnviar() {
        const botonEnviar = document.querySelector('#timesheet-action-button-submit')
        if (botonEnviar != null) {
            if (botonEnviar.style.display === 'none') {
                botonEnviar.style.pointerEvents = ''
                botonEnviar.style.display = ''
            } else {
                botonEnviar.style.pointerEvents = 'none'
                botonEnviar.style.display = 'none'
            }
        }
    }
    ////////////////////////////
    ////////////////////////////
    ////////////////////////////
    ////////////////////////////
    ////////////////////////////
    ////////////////////////////
    ////////////////////////////
    async actualizarUltimaHora() {
        this.mostrarDia()
        const dayTitle = this.getMain().querySelector(this.getSelectorHoy())
        const day = dayTitle.parentNode
        const startEndEditors = day.querySelectorAll('timesheet-start-end-editor')
        const lastEditor = startEndEditors[startEndEditors.length - 1]
        const inputs = lastEditor.querySelectorAll('.wx-time-input')
        // const startInput = inputs[0]
        const endInput = inputs[1]
        const endDate = this.adjustClockinTime(Date.now(), false)
        await this.setInputTime(endInput, endDate)
        this.saveDay()
    }
    mostrarDia(dayTitle) {
        if (dayTitle == null) {
            dayTitle = this.getMain().querySelector(this.getSelectorHoy())
        }
        if (dayTitle != null) {
            const day = dayTitle.parentNode
            const dayRect = day.getBoundingClientRect()
            document.body.scrollTo(0, dayRect.top + document.body.scrollTop - 110)
            let isExpanded = dayTitle.getAttribute('aria-expanded') === 'true'
            if (!isExpanded) {
                dayTitle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
            }
        }
    }
    async crearDiaAleatorio(dayTitle) {
        if (dayTitle == null) {
            dayTitle = this.getMain().querySelector(this.getSelectorHoy())
        }
        if (dayTitle != null) {
            this.mostrarDia(dayTitle)
            this.eliminarTodosLosEditores(dayTitle)
            const day = dayTitle.parentNode
            let startEndEditors = day.querySelectorAll('timesheet-start-end-editor')
            let firstEditor = startEndEditors[0]
            let inputs = firstEditor.querySelectorAll('.wx-time-input')
            let startInput = inputs[0]
            let endInput = inputs[1]


            const start1 = new Date()

            let inicio = parseInt(this.storageGet('hora-inicio'))
            inicio = isNaN(inicio) ? 8 : inicio
            let comida = parseInt(this.storageGet('hora-comida'))
            comida = isNaN(comida) ? 14 : comida
            let duracionComida = parseInt(this.storageGet('duracion-comida'))
            duracionComida = isNaN(duracionComida) ? 20 : duracionComida

            const minutoInicio = this.randomInt(0, 15)
            start1.setHours(inicio)
            start1.setMinutes(minutoInicio)

            const c = (comida - inicio) * 60
            const rndComida = this.randomInt(this.randomInt(c - 30, c), this.randomInt(c, c + 30))
            const end1 = new Date(start1.getTime() + (rndComida * 60000))


            const start1Date = this.adjustClockinTime(start1, false)
            const end1Date = this.adjustClockinTime(end1, false)


            await this.setInputTime(startInput, start1Date)
            await this.setInputTime(endInput, end1Date)

            ////
            await this.addNewStartEndEditor(dayTitle)
            startEndEditors = day.querySelectorAll('timesheet-start-end-editor')
            let lastEditor = startEndEditors[startEndEditors.length - 1]
            inputs = lastEditor.querySelectorAll('.wx-time-input')
            startInput = inputs[0]
            endInput = inputs[1]
            ////

            const rndComiendo = this.randomInt(duracionComida - 5, duracionComida + 5)
            const start2 = new Date(end1.getTime() + (rndComiendo * 60000))
            const restantes = this.minutosJornada - rndComida
            const end2 = new Date(start2.getTime() + ((restantes + this.randomInt(-5, 10)) * 60000))

            const start2Date = this.adjustClockinTime(start2, false)
            const end2Date = this.adjustClockinTime(end2, false)

            await this.setInputTime(startInput, start2Date)
            await this.setInputTime(endInput, end2Date)

            await this.saveDay()
        }
    }

    renderMinutos(minutos, usarSigno = false) {
        let signo = Math.sign(minutos) >= 0 ? '+' : '-'
        signo = usarSigno ? signo : ""
        let horas = Math.abs(Math.trunc(minutos / 60))
        let mins = Math.abs(minutos % 60)
        return `${signo} ${horas}h ${mins}m`
    }

    getSelectorHoy() {
        const dateNow = new Date()
        const year = dateNow.getFullYear()
        const month = ('00' + (dateNow.getMonth() + 1)).slice(-2)
        const monthDay = ('00' + dateNow.getDate()).slice(-2)
        return `timesheet-day > [id="timesheet-day-${year}-${month}-${monthDay}"]`
    }
    getDayTitleDate(dayTitle) {
        const auxSplit = dayTitle.getAttribute('id').split('timesheet-day-')[1].split('-')
        const dtYear = parseInt(auxSplit[0])
        const dtMonth = parseInt(auxSplit[1]) - 1
        const dtDay = parseInt(auxSplit[2])

        const date = new Date()
        date.setFullYear(dtYear)
        date.setMonth(dtMonth)
        date.setDate(dtDay)
        date.setHours(0, 0, 1)
        return date
    }

    getTiempoTrabajadoHoy() {
        let horas = 0, minutos = 0
        const main = this.getMain()
        if (main != null) {
            const dayTitle = main.querySelector(this.getSelectorHoy())
            if (dayTitle != null) {
                const daySummary = dayTitle.querySelector('.wx-timesheet-day__summary')
                const text = daySummary.innerText.trim()
                if (text != "") {
                    const split = text.split('h')
                    horas = parseInt(split[0].trim())
                    minutos = parseInt(split[1].trim().split('m')[0].trim())
                }
            }
        }
        return { horas: horas, minutos: minutos, totalMinutos: (horas * 60 + minutos) }
    }
    getTiempoTrabajadoMes() {
        const main = this.getMain()
        const allDays = main.querySelectorAll("timesheet-day")
        let accumulatedMin = 0
        for (let i = 0; i < allDays.length; i++) {
            const day = allDays[i]
            const dayTitle = day.querySelector('[class^="wx-timesheet-day"]')
            if (!this.esDiaDeGuardia(dayTitle)) {
                const daySummary = day.querySelector('.wx-timesheet-day__summary')
                const text = daySummary.innerText.trim()
                if (text != "") {
                    const split = text.split('h')
                    const hora = parseInt(split[0].trim())
                    const minuto = parseInt(split[1].trim().split('m')[0].trim())
                    const minutosDia = hora * 60 + minuto
                    accumulatedMin += minutosDia
                }
            }
        }
        const horas = Math.floor(accumulatedMin / 60)
        const minutos = accumulatedMin % 60
        return { horas: horas, minutos: minutos, totalMinutos: accumulatedMin }
    }
    async getDiasTrabajoMes() {
        const dayTitles = this.getMain().querySelectorAll('.wx-timesheet-day__header-weekday')
        let todayTitle = this.getMain().querySelector(this.getSelectorHoy())
        if (todayTitle == null) {
            //Si today no existe asumo que ya ha pasado el mes de esta hoja y pongo el ultimo día como today
            todayTitle = dayTitles[dayTitles.length - 1]
        }
        let contadorDias = 0
        let contadorNoTrabajo = 0
        let contadorMediosDias = 0
        let posicionHoy = 0
        let minutosATrabajar = 0
        let minutosATrabajarHastaHoy = 0


        // Conserver expandido actual
        const posicionSroll = document.body.scrollTop
        let diaExpandido = null
        for (let i = 0; i < dayTitles.length; i++) {
            const dayTitle = dayTitles[i]
            let isExpanded = dayTitle.getAttribute('aria-expanded') === 'true'
            if (isExpanded) {
                diaExpandido = dayTitle
            }
        }

        const diasTrabajo = []
        for (let i = 0; i < dayTitles.length; i++) {
            const dayTitle = dayTitles[i]
            const dayIndicators = dayTitle.querySelector('.wx-timesheet-day__indicators')
            const esMedioDiaDeTrabajo = await this.esMedioDiaDeTrabajo(dayTitle)
            if (esMedioDiaDeTrabajo) {
                contadorMediosDias++
                minutosATrabajar += this.minutosMediaJornada
                diasTrabajo.push({ dayTitle: dayTitle, esMedio: esMedioDiaDeTrabajo })
            } else if (this.esDiaDeTrabajo(dayIndicators)) {
                contadorDias++
                minutosATrabajar += this.minutosJornada
                diasTrabajo.push({ dayTitle: dayTitle, esMedio: esMedioDiaDeTrabajo })
            }else{
                contadorNoTrabajo++
            }
        }

        let enterosHastaHoy = 0
        let mediosHastaHoy = 0
        for (let i = 0; i < diasTrabajo.length; i++) {
            const dayTitle = diasTrabajo[i].dayTitle
            const esMedio = diasTrabajo[i].esMedio
            const dayDate = this.getDayTitleDate(dayTitle)
            const now = new Date()
            if (dayDate <= now && dayDate.getDate() <= now.getDate()) {
                posicionHoy++
                if (esMedio) {
                    minutosATrabajarHastaHoy += this.minutosMediaJornada
                    mediosHastaHoy++
                } else {
                    minutosATrabajarHastaHoy += this.minutosJornada
                    enterosHastaHoy++
                }
            }
        }

        // Restaurar expandido actual
        document.body.scrollTo(0, posicionSroll)
        if (diaExpandido != null) {
            let isExpanded = diaExpandido.getAttribute('aria-expanded') === 'true'
            if (!isExpanded) {
                diaExpandido.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
            }
        }

        return {
            posicionHoy: posicionHoy,
            notrabajo: contadorNoTrabajo,
            total: contadorDias,
            totalMedios: contadorMediosDias,
            minutosATrabajar: minutosATrabajar,
            minutosATrabajarHastaHoy: minutosATrabajarHastaHoy,
            diasTrabajo: diasTrabajo,
            enterosHastaHoy: enterosHastaHoy,
            mediosHastaHoy: mediosHastaHoy
        }
    }
    esDiaDeTrabajo(dayIndicators) {
        if (dayIndicators.children.length > 0) {
            for (let i = 0; i < dayIndicators.children.length; i++) {
                const child = dayIndicators.children[i]
                for (let j = 0; j < child.classList.length; j++) {
                    const clase = child.classList[j]
                    for (let k = 0; k < this.indicadoresNoTrabajo.length; k++) {
                        const indicador = this.indicadoresNoTrabajo[k]
                        if (clase.indexOf(indicador) != -1) {
                            return false
                        }
                    }
                }
            }
        }
        return true
    }
    async esMedioDiaDeTrabajo(dayTitle) {
        return this.esDiaDe('medio', dayTitle)
    }
    esDiaDeGuardia(dayTitle) {
        return this.esDiaDe('guardia', dayTitle)
    }
    esDiaDe(tipoDeDia, dayTitle) {
        const dayIndicators = dayTitle.querySelector('.wx-timesheet-day__indicators')
        let foundComment = false
        if (dayIndicators.children.length > 0) {
            for (let i = 0; i < dayIndicators.children.length; i++) {
                const child = dayIndicators.children[i]
                for (let j = 0; j < child.classList.length; j++) {
                    const clase = child.classList[j]
                    if (clase.indexOf('indicator-self-comment') != -1) {
                        foundComment = true
                        break
                    }
                }
                if (foundComment === true) {
                    break
                }
            }
        }
        if (foundComment === true) {
            let isExpanded = dayTitle.getAttribute('aria-expanded') === 'true'
            if (!isExpanded) {
                dayTitle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
            }
            let els1 = Array.from(dayTitle.parentNode.querySelectorAll('textarea'))
            let els2 = Array.from(dayTitle.parentNode.querySelectorAll('.wx-comment__body'))
            if (!isExpanded) {
                dayTitle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
            }
            els1 = els1.filter(el => {
                return el.getAttribute('ng-reflect-model').toLowerCase().indexOf(tipoDeDia) != -1
            })
            els2 = els2.filter(el => {
                return el.innerHTML.trim().toLowerCase().indexOf(tipoDeDia) != -1
            })
            if (els1.length > 0 || els2.length > 0) {
                return true
            }
        }
        return false
    }
    esFinde(dayTitle) {
        const cls = dayTitle.getAttribute('class')
        return cls.indexOf('weekend') != -1
    }

    async renderAccumulatedTimePerDay() {
        const main = this.getMain()
        const allDays = main.querySelectorAll("timesheet-day")
        let accumulatedMin = 0
        for (let i = 0; i < allDays.length; i++) {
            const day = allDays[i]
            const dayTitle = day.querySelector('[class^="wx-timesheet-day"]')
            const esMedio = await this.esMedioDiaDeTrabajo(dayTitle)
            let minutosJornada = 0
            if (!this.esFinde(dayTitle)) {
                minutosJornada = esMedio === true ? this.minutosMediaJornada : this.minutosJornada
            }
            const daySummary = day.querySelector('.wx-timesheet-day__summary')
            const text = daySummary.innerText.trim()
            const id = dayTitle.getAttribute("id")
            const accumuladoId = `${id}-acumulado`
            let accEl = dayTitle.querySelector(`#${accumuladoId}`)
            if (accEl == null) {
                accEl = document.createElement("div")
                accEl.setAttribute("id", `${id}-acumulado`)
                accEl.classList.add('acumulado-por-dia', 'fs60')
                dayTitle.appendChild(accEl)
            }
            if (text != "") {
                const split = text.split('h')
                const minutes = parseInt(split[0].trim()) * 60 + parseInt(split[1].trim().split('m')[0].trim())
                let diffMin = 0
                if (!this.esDiaDeGuardia(dayTitle)) {
                    diffMin = minutes - minutosJornada
                    accumulatedMin += diffMin
                }

                const colorDiffMin = diffMin < 0 ? "naranja" : "turquesa";
                const colorAccMin = accumulatedMin < 0 ? "naranja" : "turquesa";

                if (minutes > 0)
                    accEl.innerHTML = `
                        <span class="gris">Día: </span>
                        <span class="${colorDiffMin}" title="Horas trabajadas de más en el dia.">
                            ${this.renderMinutos(diffMin, true)}
                        </span>
                        &nbsp;&nbsp;
                        <span class="gris">Mes: </span>
                        <span class="${colorAccMin}" title="Horas acumuladas en el mes hasta fecha.">
                            ${this.renderMinutos(accumulatedMin, true)}
                        </span>
                    `
                else {
                    accEl.innerHTML = ''
                }
            } else {
                accEl.innerHTML = ''
            }
        }
    }

    getHoraSalidaHoy(minutosRestantes) {
        let salida = new Date(Date.now() + minutosRestantes * 60000)
        let salidaMinutos = salida.getMinutes()
        let formatoMinutos = salidaMinutos < 10 ? "0" + salidaMinutos : salidaMinutos
        return `<b>${salida.getHours()}:${formatoMinutos}</b>
        <span> ${salida.getDate()} ${this.meses[salida.getMonth()]}</span>`
    }

    renderHoy(parent, dat) {
        let hoyEl = parent.querySelector('#hoy')
        if (hoyEl == null) {
            hoyEl = document.createElement('div')
            hoyEl.setAttribute('id', 'hoy')
            parent.appendChild(hoyEl)
        }
        const t1 = 'Abrir hoy'
        const t2 = 'Registrar tiempos aleatoriamente hoy'
        const t = this.getTiempoTrabajadoHoy()

        const datHoy = dat.diasTrabajo[dat.posicionHoy - 1]
        const mj = datHoy != null ? (datHoy.esMedio ? this.minutosMediaJornada : this.minutosJornada) : 0
        hoyEl.innerHTML = `
            <div style="height:10px"></div>
            <div class="titulo1 d-flex">
                <div class="i">Hoy</div>
                <div class="flex"></div>
                <div id="aleatorio" class="pntr azul n" title="${t2}">&#9860; &nbsp;</div>
                <div id="verHoy" class="pntr azul n" title="${t1}">&#x27A1; &nbsp;</div>
            </div>
            <div class="contenido1">
                <span class="verde b"> ${t.horas}h ${t.minutos}m  </span>
                <span class=""> de </span>
                <span class="b"> ${this.renderMinutos(mj)} </span>
            </div>
        `
        const verHoy = hoyEl.querySelector('#verHoy')
        verHoy.addEventListener('click', () => {
            this.mostrarDia()
        })
        const aleatorio = hoyEl.querySelector('#aleatorio')
        aleatorio.addEventListener('click', async () => {
            await this.crearDiaAleatorio()
        })
    }
    async renderMesHastaHoy(parent, dat) {
        let mesEl = parent.querySelector('#meshoy')
        if (mesEl == null) {
            mesEl = document.createElement('div')
            mesEl.setAttribute('id', 'meshoy')
            parent.appendChild(mesEl)
        }
        const t = this.getTiempoTrabajadoMes()
        const mj = this.minutosJornada
        const mmj = this.minutosMediaJornada

        const minutosRestantes = (t.totalMinutos) - (dat.minutosATrabajarHastaHoy)
        let txtRestantes = '', colorRestantes = ''
        if (minutosRestantes < 0) {
            colorRestantes = 'naranja'
            txtRestantes = 'restantes'
        } else {
            colorRestantes = 'turquesa'
            txtRestantes = 'de más'
        }
        mesEl.innerHTML = `
            <div style="height:10px"></div>
            <div class="titulo1 d-flex jc-sb">
                <div class="i">Este mes hasta hoy</div>
            </div>
            <div class="contenido1">
                <div class=" ">
                    <span class="b morado"> ${dat.posicionHoy}º día </span> de
                    <span class="b"> ${dat.total + dat.totalMedios} </span> días laborables
                </div>
                <div class=" ">
                    <span class="verde b"> ${this.renderMinutos(t.totalMinutos)}</span>
                    <span class=""> de </span>
                    <span class="b"> ${this.renderMinutos(dat.minutosATrabajarHastaHoy)}</span>
                    <span class="gris fs80"> 
                        ${dat.enterosHastaHoy} x ${this.renderMinutos(mj)} +
                        ${dat.mediosHastaHoy} x ${this.renderMinutos(mmj)}
                    </span>
                </div>
                <div class=" ">
                    <span class="${colorRestantes} b"> ${this.renderMinutos(minutosRestantes, true)}</span> ${txtRestantes}
                </div>
            </div>
            <div style="height:5px"></div>
            <div class="titulo1 d-flex jc-sb">
                <div class="i">Hora de salida hoy</div>
            </div>
            <div class="contenido1">
                ${this.getHoraSalidaHoy(-minutosRestantes)}
            </div>
        `
    }
    async renderMes(parent, dat) {
        let mesEl = parent.querySelector('#mes')
        if (mesEl == null) {
            mesEl = document.createElement('div')
            mesEl.setAttribute('id', 'mes')
            parent.appendChild(mesEl)
        }
        const t = this.getTiempoTrabajadoMes()
        const mj = this.minutosJornada
        const mmj = this.minutosMediaJornada

        const minutosATrabajar = (mj * dat.total) + (mmj * dat.totalMedios)
        const minutosRestantes = (t.horas * 60 + t.minutos) - (minutosATrabajar)
        let txtRestantes = '', colorRestantes = ''
        if (minutosRestantes < 0) {
            colorRestantes = 'naranja'
            txtRestantes = 'restantes'
        } else {
            colorRestantes = 'turquesa'
            txtRestantes = 'de más'
        }
        const t1 = 'Mostrar/Ocultar botón de enviar'
        mesEl.innerHTML = `
            <div style="height:10px"></div>
            <div class="titulo1 d-flex jc-sb">
                <div class="i">Este mes</div>
                <div id="verEnviar" class="pntr azul n" title="${t1}">&#9993; &nbsp;</div>
            </div>
            <div class="contenido1">
                <div class=" ">
                    <span class="b rojo"> ${dat.notrabajo} </span> días no laborables
                    <br>
                    <span class="b"> ${dat.totalMedios} </span> &#189; días laborables
                    <br>
                    <span class="b"> ${dat.total} </span> días laborables
                </div>
                <div class=" ">
                    <span class="verde b"> ${this.renderMinutos(t.horas * 60 + t.minutos)}</span>
                    <span class=""> de </span>
                    <span class="b"> ${this.renderMinutos(minutosATrabajar)}</span>
                    <span class="gris fs80"> 
                        ${dat.total} x ${this.renderMinutos(mj)} + 
                        ${dat.totalMedios} x ${this.renderMinutos(mmj)}
                    </span>
                </div>
                <div class=" ">
                    <span class="${colorRestantes} b"> ${this.renderMinutos(minutosRestantes, true)}</span> ${txtRestantes}
                </div>
            </div>
        `
        const sobre = mesEl.querySelector('#verEnviar')
        sobre.addEventListener('click', () => {
            this.alternarBotonEnviar()
        })
    }

    renderConfiguracion(parent) {
        let configEl = parent.querySelector('#configuracion')
        if (configEl == null) {
            configEl = document.createElement('div')
            configEl.setAttribute('id', 'configuracion')
            parent.appendChild(configEl)
        }

        let inicio = parseInt(this.storageGet('hora-inicio'))
        inicio = isNaN(inicio) ? 8 : inicio
        let comida = parseInt(this.storageGet('hora-comida'))
        comida = isNaN(comida) ? 14 : comida
        let duracionComida = parseInt(this.storageGet('duracion-comida'))
        duracionComida = isNaN(duracionComida) ? 20 : duracionComida

        const t2 = "Registrar tiempos aleatoriamente en el actual día expandido"
        configEl.innerHTML = `
            <div style="height:10px"></div>
            <div class="titulo1 d-flex">
                <div class="i">Configuración día aleatorio</div>
                <div class="flex"></div>
                <div id="aleatorio" class="pntr azul n" title="${t2}">&#9860; &nbsp;</div>
            </div>
            <div class="contenido1">
                <div class="d-flex ai-c">
                    <div class="gris" style="width:9em">&#9857; Hora inicio</div>
                    <div class="flex">
                        <input id="horaInicio" class="texto" type="number" value="${inicio}" placeholder="8">
                    </div>
                </div>
                <div class="d-flex ai-c">
                    <div class="gris" style="width:9em">&#9859; Hora comida</div>
                    <div class="flex">
                        <input id="horaComida" class="texto" type="number" value="${comida}" placeholder="14">
                    </div>
                </div>
                <div class="d-flex ai-c">
                    <div class="gris" style="width:9em">&#9858; Minutos comida</div>
                    <div class="flex">
                        <input id="minutosComida" class="texto" type="number" value="${duracionComida}" placeholder="20">
                    </div>
                </div>
            <div>
        `
        const horaInicio = configEl.querySelector('#horaInicio')
        horaInicio.addEventListener('change', (e) => {
            this.storageSet('hora-inicio', e.currentTarget.value)
        })
        const horaComida = configEl.querySelector('#horaComida')
        horaComida.addEventListener('change', (e) => {
            this.storageSet('hora-comida', e.currentTarget.value)
        })
        const minutosComida = configEl.querySelector('#minutosComida')
        minutosComida.addEventListener('change', (e) => {
            this.storageSet('duracion-comida', e.currentTarget.value)
        })

        const aleatorio = configEl.querySelector('#aleatorio')
        aleatorio.addEventListener('click', async () => {
            const dayTitles = this.getMain().querySelectorAll('.wx-timesheet-day__header-weekday')
            let diaExpandido = null
            for (let i = 0; i < dayTitles.length; i++) {
                const dayTitle = dayTitles[i]
                let isExpanded = dayTitle.getAttribute('aria-expanded') === 'true'
                if (isExpanded) {
                    diaExpandido = dayTitle
                }
            }
            if (diaExpandido != null) {
                await this.crearDiaAleatorio(diaExpandido)
            }
        })
    }


    ////////////////
    ////////////////
    ////////////////
    ////////////////
    ////////////////
    ////////////////
    getCookie(cname) {
        var name = cname + "="
        var decodedCookie = decodeURIComponent(document.cookie)
        var ca = decodedCookie.split(';')
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1)
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length).replace(/^"(.+)"$/, '$1')
            }
        }
        return ''
    }

    setCookie(cname, cvalue, exdays) {
        var d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        var expires = "expires=" + d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    }

    addStyle() {
        const style = document.createElement('style');
        style.textContent = `

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

        /**/
        #TimesheetPlus {
            position: absolute;
            left: 15px;
            margin-top: 25px;
            background-color: #fafafa;
            border-radius: 3px;
            padding: 20px;
            z-index:0;
        }
        .acumulado-por-dia {
            position:absolute;
            bottom:-3px;
            right:7px;
        }

        .pntr{
            cursor: pointer;
        }
        .boton{
            display: flex;
            justify-content: center;
            align-items: center;
            width :140px;
            height :40px;
            cursor :pointer;
            font-size :1.2em;
            color :white;
            text-align :center;
            padding :9px 0;
            border-radius: 3px;
        }
        .boton-rojo{
            background-color :#CC3333;
        }
        .boton-azul{
            background-color :#003e63;
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
        document.head.append(style);
    }
    createSVGClock() {
        const svgText = `
            <svg version="1.1" class="iconic-clock" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="50px" height="50px" viewBox="0 0 384 384" enable-background="new 0 0 384 384" xml:space="preserve">
            <path class="iconic-clock-frame"    d="M192,0C85.961,0,0,85.961,0,192s85.961,192,192,192s192-85.961,192-192S298.039,0,192,0zM315.037,315.037c-9.454,9.454-19.809,17.679-30.864,24.609l-14.976-25.939l-10.396,6l14.989,25.964c-23.156,12.363-48.947,19.312-75.792,20.216V336h-12v29.887c-26.845-0.903-52.636-7.854-75.793-20.217l14.989-25.963l-10.393-6l-14.976,25.938c-11.055-6.931-21.41-15.154-30.864-24.608s-17.679-19.809-24.61-30.864l25.939-14.976l-6-10.396l-25.961,14.99C25.966,250.637,19.017,224.846,18.113,198H48v-12H18.113c0.904-26.844,7.853-52.634,20.216-75.791l25.96,14.988l6.004-10.395L44.354,99.827c6.931-11.055,15.156-21.41,24.61-30.864s19.809-17.679,30.864-24.61l14.976,25.939l10.395-6L110.208,38.33C133.365,25.966,159.155,19.017,186,18.113V48h12V18.113c26.846,0.904,52.635,7.853,75.792,20.216l-14.991,25.965l10.395,6l14.978-25.942c11.056,6.931,21.41,15.156,30.865,24.611c9.454,9.454,17.679,19.808,24.608,30.863l-25.94,14.976l6,10.396l25.965-14.99c12.363,23.157,19.312,48.948,20.218,75.792H336v12h29.887c-0.904,26.845-7.853,52.636-20.216,75.792l-25.964-14.989l-6.002,10.396l25.941,14.978C332.715,295.229,324.491,305.583,315.037,315.037z" />
            <line class="iconic-clock-hour-hand" id="foo" fill="none" stroke="#000000" stroke-width="18" stroke-miterlimit="10" x1="192" y1="192" x2="192" y2="87.5"/>
            <line class="iconic-clock-minute-hand" id="iconic-anim-clock-minute-hand" fill="none" stroke="#000000" stroke-width="12" stroke-miterlimit="10" x1="192" y1="192" x2="192" y2="54"/>
            <circle class="iconic-clock-axis" cx="192" cy="192" r="9"/>
            <g class="iconic-clock-second-hand" id="iconic-anim-clock-second-hand">
                <line class="iconic-clock-second-hand-arm" fill="none" stroke="#ff0000" stroke-width="8" stroke-miterlimit="10" x1="192" y1="192" x2="192" y2="28.5"/>
                <circle class="iconic-clock-second-hand-axis" fill="#ff0000" cx="192" cy="192" r="4.5"/>
            </g>
            <g class="iconic-clock-milli-hand" id="iconic-anim-clock-milli-hand">
                <line class="iconic-clock-milli-hand-arm" fill="none" stroke="#198CFF" stroke-width="8" stroke-miterlimit="10" x1="192" y1="192" x2="192" y2="28.5"/>
                <circle class="iconic-clock-milli-hand-axis" fill="#198CFF" cx="192" cy="192" r="4.5"/>
            </g>
            <defs>
            <animateTransform
                    type="rotate"
                    fill="remove"
                    restart="always"
                    calcMode="linear"
                    accumulate="none"
                    additive="sum"
                    xlink:href="#iconic-anim-clock-hour-hand"
                    repeatCount="indefinite"
                    dur="43200s"
                    to="360 192 192"
                    from="0 192 192"
                    attributeName="transform"
                    attributeType="xml">
            </animateTransform>

            <animateTransform
                    type="rotate"
                    fill="remove"
                    restart="always"
                    calcMode="linear"
                    accumulate="none"
                    additive="sum"
                    xlink:href="#iconic-anim-clock-minute-hand"
                    repeatCount="indefinite"
                    dur="3600s"
                    to="360 192 192"
                    from="0 192 192"
                    attributeName="transform"
                    attributeType="xml">
            </animateTransform>

            <animateTransform
                    type="rotate"
                    fill="remove"
                    restart="always"
                    calcMode="linear"
                    accumulate="none"
                    additive="sum"
                    xlink:href="#iconic-anim-clock-second-hand"
                    repeatCount="indefinite"
                    dur="60s"
                    to="360 192 192"
                    from="0 192 192"
                    attributeName="transform"
                    attributeType="xml">
            </animateTransform>

            <animateTransform
                    type="rotate"
                    fill="remove"
                    restart="always"
                    calcMode="linear"
                    accumulate="none"
                    additive="sum"
                    xlink:href="#iconic-anim-clock-milli-hand"
                    repeatCount="indefinite"
                    dur="1s"
                    to="360 192 192"
                    from="0 192 192"
                    attributeName="transform"
                    attributeType="xml">
            </animateTransform>
            </defs>
        </svg>
        `
        const div = document.createElement("div")
        div.setAttribute('id', 'relojsvgel')
        div.innerHTML = svgText
        div.style.paddingLeft = '10px'
        div.style.display = 'none'
        const svg = div.querySelector('svg')

        var date = new Date
        var seconds = date.getSeconds()
        var minutes = date.getMinutes()
        var hours = date.getHours()
        hours = (hours > 12) ? hours - 12 : hours

        minutes = (minutes * 60) + seconds
        hours = (hours * 3600) + minutes

        svg.querySelector('.iconic-clock-milli-hand').setAttribute('transform', 'rotate(' + 360 * (seconds) + ',192,192)');
        svg.querySelector('.iconic-clock-second-hand').setAttribute('transform', 'rotate(' + 360 * (seconds / 60) + ',192,192)');
        svg.querySelector('.iconic-clock-minute-hand').setAttribute('transform', 'rotate(' + 360 * (minutes / 3600) + ',192,192)');
        svg.querySelector('.iconic-clock-hour-hand').setAttribute('transform', 'rotate(' + 360 * (hours / 43200) + ',192,192)')
        return div
    }
    randomInt(min, max) { // min and max included 
        return Math.floor(Math.random() * (max - min + 1) + min)
    }
}
new TimesheetPlus()
