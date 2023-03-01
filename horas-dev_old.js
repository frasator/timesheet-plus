class Bamboonomix {
  getMinutosJornada() {
      let mj = localStorage.getItem('minutosJornada')
      if (mj == null) {
          return 465
      } else {
          return parseInt(mj)
      }
  }
  setMinutosJornada(minutos) {
      localStorage.setItem('minutosJornada', minutos)
  }
  constructor() {
      if (window.location.href.indexOf('employees/timesheet/?id=') != -1) {
          this.meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
          this.mensajesSubliminales = [
              'Vete a casa o te reviento!',
              'Qué haces aquí matat!',
              'Eres un puto loser!',
              'Cosas que hay que saber: vete a casa!',
              'Fuera de aquí, subnormal!',
              'Deja de regalar tu tiempo, inútil',
              'No le importas a nadie, vete de aquí!',
              'Quedas expulsado. Adiós!',
              'Llegas tarde a tu puta casa',
              'Asumimos que en tu casa no te quieren',
              'Eres libre, bienvenido a la irrealidad',
              'Sei una covarianza',
              'Fuera de aquí, retromónguer!',
              'Lárgate o recibirás el CD de los chistes de Quino. :D',
              'Di en alto  ♬ Pollo Pollo Polla ♬ y vete!'
          ]
          var jsonNode = document.querySelector('#js-timesheet-data')
          var jsonData = JSON.parse(jsonNode.innerText)
          this.allTimeSheets = jsonData.employeeTimesheets
          this.timesheet = jsonData.timesheet
          localStorage.setItem('timesheets', JSON.stringify(this.allTimeSheets))
          localStorage.setItem(this.timesheet.id, JSON.stringify(this.timesheet))

          this.timesheetInfo = this.initTimesheetInfo()
          // this.timesheet.dailyDetails //dias

          for (let i = 0; i < this.allTimeSheets.length; i++) {
              const ts = this.allTimeSheets[i];
              console.log(ts.start, JSON.parse(localStorage.getItem(ts.id)))
          }

          console.log(' ')
          console.log(' ')
          console.log(' ')
          console.log(this.allTimeSheets)
          console.log(this.timesheet)
          console.log(this.timesheetInfo)

          this.start()
      }
  }
  start() {
      var msLen = this.mensajesSubliminales.length
      let mensajeIdx = this.getRandomInt(0, msLen - 1)
      let mensaje = this.mensajesSubliminales[mensajeIdx]
      this.pinta(mensaje)
      setInterval(() => { this.pinta(mensaje) }, 5000)
      document.querySelector('#employeePhoto').style.display = 'none'
      document.querySelector('.PageHeader__titleWrap').style.display = 'none'
  }
  initTimesheetInfo() {
      var timesheetInfo = {}
      for (let i = 0; i < this.allTimeSheets.length; i++) {
          let ts = this.allTimeSheets[i]
          if (ts.id == this.timesheet.id) {
              timesheetInfo = Object.assign(timesheetInfo, ts)
              break
          }
      }
      var aux = timesheetInfo.start.split('-')
      timesheetInfo.year = aux[0]
      timesheetInfo.month = aux[1]
      return timesheetInfo
  }
  getDayFromEl(el) {
      const dayDate = parseInt(el.querySelector('.TimesheetSlat__dayDate').innerText.toLowerCase().split(' ')[1])
      let cero = (dayDate < 10) ? '0' : ''
      const diaId = `${this.timesheetInfo.year}-${this.timesheetInfo.month}-${cero}${dayDate}`
      return this.timesheet.dailyDetails[diaId]
  }
  getMinutesFromHourNumber(hours) {
      var hrs = parseInt(Number(hours))
      var min = Math.round((Number(hours) - hrs) * 60)
      return (hrs * 60) + min
  }
  getMinutosGuardiaFromDia(dia, diaEl) {
      let minutos = 0
      let guardiaFlag = false
      for (let i = 0; i < dia.clockEntries.length; i++) {
          let clockEntry = dia.clockEntries[i]
          if (clockEntry.note != null && clockEntry.note.toLowerCase().trim().indexOf('guardia') != -1) {
              minutos += this.getMinutesFromHourNumber(clockEntry.hours)
              guardiaFlag = true
          }
      }
      if (guardiaFlag == false && dia.timeOff.length > 0) {
          for (let i = 0; i < dia.timeOff.length; i++) {
              let to = dia.timeOff[i]
              const auxType = to.type.toLowerCase().trim()
              if (auxType.indexOf('on call sundays') != -1 || auxType.indexOf('on call saturdays') != -1) {
                  minutos += this.getMinutesFromHourNumber(to.amount)
              }
          }
      }
      if (diaEl != null && minutos > 0) {
          var auxEl = diaEl.querySelector('.TimesheetSlat__dayTotal')
          var elNote = auxEl.querySelector('.nota')
          if (elNote == null) {
              elNote = document.createElement('span')
              elNote.classList.add('nota')
              elNote.style = `font-size:14px;color:#C2185B;padding-left:6px;`
              auxEl.appendChild(elNote)
          }
          elNote.innerHTML = `Guardia: ${this.timePrint(minutos)}`
      }
      return minutos
  }
  getHoraSalidaHoy(minutosRestantes) {
      let salida = new Date(Date.now() + minutosRestantes * 60000)
      let salidaMinutos = salida.getMinutes()
      let formatoMinutos = salidaMinutos < 10 ? "0" + salidaMinutos : salidaMinutos
      return `${salida.getHours()}:${formatoMinutos}
      <span style="color:gray"> ${salida.getDate()} ${this.meses[salida.getMonth()]}</span>`
  }
  timePrint(minutos) {
      let horas = Math.abs(Math.trunc(minutos / 60))
      let mins = Math.abs(minutos % 60)
      return `${horas}h ${mins}m`
  }
  timePrintSign(minutos) {
      let signo = Math.sign(minutos) >= 0 ? '-' : '+'
      return `${signo}${this.timePrint(minutos)}`
  }
  timePrintNegative(minutos) {
      let stl = `color:#e53935;`
      let res = this.timePrintSign(minutos)
      if (minutos < 0) {
          return `<i style="${stl}">${res}</i>`
      } else {
          return res
      }
  }
  calcMinutosTrabajo(dias, mediosDias) {
      const minutosMedioDia = (this.getMinutosJornada() + 15) / 2
      return (dias * (this.getMinutosJornada())) + (mediosDias * minutosMedioDia)
  }
  parseTimeText(el) {
      let textTime = el.querySelector('.TimesheetSlat__dayTotal').innerText
      let parsedHours = parseInt(textTime.split('h')[0])
      let parsedMinutes = parseInt(textTime.split(' ')[1].split('m')[0])
      return { hours: parsedHours, minutes: parsedMinutes }
  }

  calcularMinutosATrabajar(els) {
      var minutosTrabajados = 0;
      var diasATrabajar = 0
      var diasOtros = 0
      var mediosDiasATrabajar = 0
      var minutosMedicalAppointments = 0
      var minutosGuardia = 0


      for (var i = 0; i < els.length; i++) {
          let el = els[i]
          const dayName = el.querySelector('.TimesheetSlat__dayOfWeek').innerText.toLowerCase()
          const dayDate = el.querySelector('.TimesheetSlat__dayDate').innerText.toLowerCase()

          let dia = this.getDayFromEl(el)
          // console.log(dia)
          minutosGuardia += this.getMinutosGuardiaFromDia(dia, el)

          /* Trabajados */
          let parsed_a = this.parseTimeText(el)
          minutosTrabajados += parsed_a.hours * 60
          minutosTrabajados += parsed_a.minutes

          /* A trabajar */
          let extra = el.querySelector('.TimesheetSlat__extraInfoItem--clockPush')

          if (dayName != "sat" && dayName != "sun" && dayName != "sáb" && dayName != "dom") {
              if (dia.holidays.length > 0) {
                  diasOtros++
              } else if (dia.timeOff.length > 0) {
                  if (dia.timeOffHours == 4) {
                      diasOtros += 0.5
                      mediosDiasATrabajar += 1
                  }else  if (extra != null && extra.innerText.indexOf('hours Medical Appointments') != -1) {
                      minutosMedicalAppointments += parsed_a.hours * 60
                      minutosMedicalAppointments += parsed_a.minutes
                      diasOtros++
                  } else {
                      diasOtros++
                  }
              } else {
                  diasATrabajar++
              }
              //
              //
              // let extra = el.querySelector('.TimesheetSlat__extraInfoItem--clockPush')
              // if (extra == null) {
              //     diasATrabajar++
              // } else {
              //     if (extra.innerText.indexOf('0.5 days Holidays') != -1
              //         || extra.innerText.indexOf('0.5 days Additional Days Off') != -1) {
              //         diasOtros += 0.5
              //         mediosDiasATrabajar += 1
              //     } else if (extra.innerText.indexOf('hours Medical Appointments') != -1) {
              //         let parsed = this.parseTimeText(el)
              //         minutosMedicalAppointments += parsed.hours * 60
              //         minutosMedicalAppointments += parsed.minutes
              //     } else {
              //         diasOtros++
              //     }
              //     // Private Leave
              //     // Compensation:
              //     // Holydays
              //     // Business Trips
              // }
          }
      }
      var minutosATrabajar = this.calcMinutosTrabajo(diasATrabajar, mediosDiasATrabajar)
      minutosATrabajar += minutosMedicalAppointments

      return {
          minutosATrabajar: minutosATrabajar,
          minutosTrabajados: minutosTrabajados,
          diasOtros: diasOtros,
          diasATrabajar: diasATrabajar,
          mediosDiasATrabajar: mediosDiasATrabajar,
          minutosGuardia: minutosGuardia,
          minTrabajadosMenosGuardias: minutosTrabajados - minutosGuardia
      }
  }
  getWeeks() {
      var weeks = []
      var weekNum = 0
      for (var i = 0; i < this.diasMesConFinde.length; i++) {
          let el = this.diasMesConFinde[i]
          const dayName = el.querySelector('.TimesheetSlat__dayOfWeek').innerText
          const dayDate = el.querySelector('.TimesheetSlat__dayDate').innerText

          if (weeks[weekNum] == null) {
              weeks[weekNum] = []
          }
          if (dayName == "Mon") {
              if (weeks[weekNum].length == 0) {
                  weeks[weekNum].push(el)
              } else {
                  weekNum += 1
                  weeks[weekNum] = []
                  weeks[weekNum].push(el)
              }
          } else {
              weeks[weekNum].push(el)
          }
      }
      return weeks
  }
  pinta(mensaje) {
      this.lastMensaje = mensaje
      const tr = `background-color:transparent;`
      const td = `padding:0;text-align: right;`
      const ks = `color:#666;font-size:14px;`
      const fks = `width:80px;${ks}`
      const note = `font-style: italic;font-size:12px`
      const vs = ``
      const vs1 = `${vs}width:26px;color:#BA68C8;font-size:14px;`
      const vs2 = `${vs}color:#4CAF50;font-size:14px`
      const vs3 = `${vs}width:26px;color:#EC407A;font-size:14px`
      const vs4 = `${vs}color:#039BE5;font-size:14px`
      const vs5 = `${vs}color:#FF6F00;font-size:14px`
      const vs6 = `${vs}color:#888;font-size:14px`
      const vs7 = `${vs}color:#4CAF50;font-size:14px`
      const vs8 = `${vs}color:#00ACC1;font-size:14px`
      const vs9 = `${vs}color:#C2185B;font-size:14px`
      const vs10 = `${vs}color:#BA68C8;font-size:14px`
      const vs11 = `${vs}color:#ff0000;font-size:14px`

      var aux1 = document.querySelector('.TimesheetEntries')
      var diasMesConFinde = aux1.querySelectorAll('.TimesheetSlat:not(.TimesheetSlat--disabled)')
      // var diasMesSinFinde = aux1.querySelectorAll('.TimesheetSlat:not(.TimesheetSlat--disabled):not(.js-timesheet-showWeekends)')
      // var weeks = this.getWeeks()
      var hoyEl = aux1.querySelector('.TimesheetSlat--today')

      var diasHastaHoy = []
      for (var i = 0; i < diasMesConFinde.length; i++) {
          let el = diasMesConFinde[i]
          diasHastaHoy.push(el)
          if (el == hoyEl) {
              break
          }
      }

      var mes = this.calcularMinutosATrabajar(diasMesConFinde)
      this.setMonthHistory(mes)

      var hastaHoy = this.calcularMinutosATrabajar(diasHastaHoy)


      var parsedHoy
      if (hoyEl) {
          parsedHoy = this.parseTimeText(hoyEl)
      }


      /* DIV */
      // var siblingEl = document.querySelector('.TimesheetSummary__photo')
      var siblingEl = document.querySelector('.Employee__contactInfoContainer')
      var div = document.querySelector('#infoextra')
      if (!div) {
          div = document.createElement('div')
          div.style.padding = '0 0 10px 0'
          div.style.margin = '0 0 10px 0'
          div.style.textAlign = 'left'
          div.style.backgroundColor = '#f6f6f6'
          div.style.borderBottom = '1px solid lightgray'
          div.id = 'infoextra'

          let closeCont = document.createElement('div')
          closeCont.style.width = '100%'
          closeCont.style.position = 'absolute'
          closeCont.style.top = '-22px'
          closeCont.style.left = '0px'
          closeCont.style.display = 'flex'
          let close = document.createElement('div')
          close.style = `font-style:italic;font-weight:bold;
                  background-color:#fafafa;
                  cursor:pointer;padding:2px 7px 3px 7px;line-height:15px;border:1px solid #ddd;`
          close.innerHTML = 'Ocultar'
          closeCont.appendChild(close)
          let separator = document.createElement('div')
          separator.style.width = '5px'
          closeCont.appendChild(separator)
          let minJorInput = document.createElement('div')
          minJorInput.innerHTML = "Minutos"
          minJorInput.style = `font-style:italic;font-weight:bold;
                  background-color:#fafafa;
                  cursor:pointer;padding:2px 7px 3px 7px;line-height:15px;border:1px solid #ddd;`
          minJorInput.addEventListener('click', e => {
              const res = window.prompt("Modifica los minutos de una jornada, tendrás que revisitar todos los meses.", this.getMinutosJornada())
              const minutos = parseInt(res)
              if (!isNaN(minutos)) {
                  this.setMinutosJornada(minutos)
                  this.pinta(this.lastMensaje)
              }
          })
          closeCont.appendChild(minJorInput)

          close.addEventListener('click', e => {
              if (div.style.display == 'none') {
                  div.style.display = ''
                  close.innerHTML = 'Ocultar'
              } else {
                  div.style.display = 'none'
                  close.innerHTML = 'Mostrar'
              }
          })
          siblingEl.parentNode.insertBefore(div, siblingEl)
          siblingEl.parentNode.insertBefore(closeCont, div)
      }


      /* HTML */
      var hoyHTML = ``
      if (parsedHoy != null) {
          hoyHTML = `
              <span style="${ks}">Hoy: </span>
              <span style="${vs7}">${parsedHoy.hours}h ${parsedHoy.minutes}m</span>
              ${((parsedHoy.hours * 60) + parsedHoy.minutes >= this.getMinutosJornada()) ? `<br><span style="${vs6}">${mensaje}</span>` : ''}
              <span style="${ks}"> de </span>
              <span style="${vs4}">${this.timePrint(this.getMinutosJornada())}</span>
              <div style="height:1px;background-color:lightgray;margin:10px 0"></div>
      `
      }

      var guardiasHastaHoyHTML = ``
      if (hastaHoy.minutosGuardia > 0) {
          guardiasHastaHoyHTML = `
              <tr style="${tr}">
                  <td></td>
                  <td style="${td}${vs9}">${this.timePrint(hastaHoy.minutosGuardia)}</td>
                  <td style="${td}${note}">Guardias</td>
              </tr>
      `
      }
      var guardiasMesHTML = ``
      if (mes.minutosGuardia > 0) {
          guardiasMesHTML = `
              <tr style="${tr}">
                  <td></td>
                  <td style="${td}${vs9}">${this.timePrint(mes.minutosGuardia)}</td>
                  <td style="${td}${note}">Guardias</td>
              </tr>
      `
      }


      let year = this.getYearHistory(this.getYearSelectValue())
      var guardiasAñoHTML = (year.minutosGuardia > 0) ? `
          <div style="margin-top:1em">
              <span>Guardias:</span>
              <span style="${vs9}">${this.timePrint(year.minutosGuardia)}</span>
          </div>
    ` : ``


      div.innerHTML = `
          ${hoyHTML}

          <span style="${vs10};"><b>
              ${hastaHoy.diasATrabajar + hastaHoy.mediosDiasATrabajar / 2}º</b> día de 
              ${mes.diasATrabajar + mes.mediosDiasATrabajar / 2}</span>
          <span style="${ks};"> laborables</span>
          <table>
              <tr style="${tr}">
                  <td></td>
                  <td style="${td}${vs4}">${this.timePrint(hastaHoy.minutosATrabajar)}</td>
                  <td style="${td}${note}">${hastaHoy.diasATrabajar + hastaHoy.mediosDiasATrabajar / 2} x 
                      ${this.timePrint(this.getMinutosJornada())}</td>
              </tr>
              <tr style="${tr}">
                  <td style="${td}${vs2}">${Bamboonomix.timeIcon}</td>
                  <td style="${td}${vs2}">${this.timePrint(hastaHoy.minTrabajadosMenosGuardias)}</td>
                  <td style="${td}${note}">Curradas</td>
              </tr>
              <tr style="${tr}">
                  <td style="${td}${vs5}">${Bamboonomix.timeIcon}</td>
                  <td style="${td}${vs5}">${this.timePrintNegative(hastaHoy.minutosATrabajar - hastaHoy.minTrabajadosMenosGuardias)}</td>
                  <td style="${td}${note}">Restantes</td>
              </tr>
              ${guardiasHastaHoyHTML}
          </table>
          
          <span style="${ks}"> Hora de salida: </span>
          <span style="${vs8}">${this.getHoraSalidaHoy(hastaHoy.minutosATrabajar - hastaHoy.minTrabajadosMenosGuardias)}</span>

          <div style="height:1px;background-color:lightgray;margin:10px 0"></div>

          <span style="${ks}">Este mes</span><br>
          <span style="${vs1}"><b>${mes.diasATrabajar + mes.mediosDiasATrabajar / 2}</b></span>
          <span style="${ks}">días laborables</span><br>
          <span style="${vs3}">${mes.diasOtros}</span>
          <span style="${ks}" title="Cualquier tipo de Time Off y Festivos">días no laborables</span>
          <table>
              <tr style="${tr}">
                  <td></td>
                  <td style="${td}${vs4}">${this.timePrint(mes.minutosATrabajar)}</td>
                  <td style="${td}${note}">${mes.diasATrabajar + mes.mediosDiasATrabajar / 2} x ${this.timePrint(this.getMinutosJornada())}</td>
              </tr>
              <tr style="${tr}">
                  <td style="${td}${vs2}">${Bamboonomix.timeIcon}</td>
                  <td style="${td}${vs2}">${this.timePrint(mes.minTrabajadosMenosGuardias)}</td>
                  <td style="${td}${note}">Curradas</td>
              </tr>
              <tr style="${tr}">
                  <td style="${td}${vs5}">${Bamboonomix.timeIcon}</td>
                  <td style="${td}${vs5}">${this.timePrintNegative(mes.minutosATrabajar - mes.minTrabajadosMenosGuardias)}</td>
                  <td style="${td}${note}">Restantes</td>
              </tr>
              ${guardiasMesHTML}
          </table>

          <div style="height:1px;background-color:lightgray;margin:10px 0"></div>

          <span style="${ks}">Este año hasta final de <b>${year.months[0].nombre}</b></span>
          <br>
          <span style="${vs1}"><b>${year.diasATrabajar + year.mediosDiasATrabajar / 2}</b></span>
          <span style="${ks}">días laborables</span><br>
          <span style="${vs3}">${year.diasOtros}</span>
          <span style="${ks}" title="Cualquier tipo de Time Off y Festivos">días no laborables</span>
          <table>
              <tr style="${tr}">
                  <td></td>
                  <td style="${td}${vs4}">${this.timePrint(year.minutosATrabajar)}</td>
                  <td style="${td}${note}">${year.diasATrabajar + year.mediosDiasATrabajar / 2} x ${this.timePrint(this.getMinutosJornada())}</td>
              </tr>
              <tr style="${tr}">
                  <td style="${td}${vs2}">${Bamboonomix.timeIcon}</td>
                  <td style="${td}${vs2}">${this.timePrint(year.minTrabajadosMenosGuardias)}</td>
                  <td style="${td}${note}">Curradas</td>
              </tr>
              <tr style="${tr}">
                  <td style="${td}${vs5}">${Bamboonomix.timeIcon}</td>
                  <td style="${td}${vs5}">
                      ${this.timePrintNegative(year.minutosATrabajar - year.minTrabajadosMenosGuardias)}</td>
                  <td style="${td}${note}">Restantes</td>
              </tr>
          </table>

          <div style="height:1px;background-color:lightgray;margin:10px 0"></div>
          <span style="${ks}">Este año acumulado hasta 
          <b>${year.months[1] != null ? year.months[1].nombre : '?'}</b></span><br>
          <span style="${vs5}">${this.timePrintNegative(year.acumuladoHastaMesAnterior)}</span>
          <div style="height:1px;background-color:lightgray;margin:10px 0"></div>
          
          <div id="yearSelectParent"></div>
          <table>
          ${year.months.map(m => `
              <tr style="${tr}">
                  <td style="${td}${m.horas == 'sin cargar' ? vs11 : ks}">${m.nombre}</td>
                  <td style="${td}${m.horas == '0h 0m' ? ks : m.horas == 'sin cargar' ? ks : vs5}">${m.horas}</td>
                  <td style="${td}${note}">${m.minutosJornada}</td>
              </tr>
          `).join(' ')}
          </table>
          ${guardiasAñoHTML}
          `

      const yearSelectParent = div.querySelector('#yearSelectParent')
      yearSelectParent.appendChild(this.createYearSelect())
  }
  setMonthHistory(mes) {
      const key = `historial-${this.timesheetInfo.id}-${this.timesheetInfo.start}`
      mes.minutosJornada = this.getMinutosJornada()
      localStorage.setItem(key, JSON.stringify(mes))
  }
  createYearSelect() {
      const yearSet = new Set()
      for (let i = 0; i < this.allTimeSheets.length; i++) {
          const ts = this.allTimeSheets[i]
          yearSet.add(new Date(ts.start).getFullYear())
      }
      const years = Array.from(yearSet).sort().reverse()

      const spanParent = document.createElement('span')
      for (let year of years) {
          const span = document.createElement('span')
          span.style = 'display:inline-block;font-style:italic;padding:0 3px;cursor:pointer;background-color:#fff;margin-right:3px;'
          span.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'
          if (this.getYearSelectValue() == year) {
              span.style.color = '#FFF'
              span.style.backgroundColor = '#00ACC1'
          }
          span.innerHTML = year
          span.dataset.year = year
          span.addEventListener('click', (e) => {
              localStorage.setItem('year-selector-value', e.target.dataset.year)
              this.pinta(this.lastMensaje)
          })
          spanParent.appendChild(span)
      }
      return spanParent
  }
  getYearSelectValue() {
      const savedYear = localStorage.getItem('year-selector-value')
      return savedYear == null ? new Date().getFullYear() : parseInt(savedYear)
  }
  getYearHistory(inputYear) {
      const year = {
          minutosATrabajar: 0,
          minTrabajadosMenosGuardias: 0,
          minutosGuardia: 0,
          acumuladoHastaMesAnterior: 0,
          months: [],
          diasATrabajar: 0,
          mediosDiasATrabajar: 0,
          diasOtros: 0,
      }
      for (let i = 0; i < this.allTimeSheets.length; i++) {
          const ts = this.allTimeSheets[i]
          const date = new Date(ts.start)
          const tsYear = date.getFullYear()
          if (inputYear == tsYear) {
              const key = `historial-${ts.id}-${ts.start}`
              const mes = JSON.parse(localStorage.getItem(key))
              const nombreMes = this.meses[date.getMonth()]
              const minutosJornada = mes != null && mes.minutosJornada != null ? this.timePrint(mes.minutosJornada) : ''
              if (mes != null) {
                  const horasRestantes = this.timePrintNegative(mes.minutosATrabajar - mes.minTrabajadosMenosGuardias)
                  year.months.push({ nombre: nombreMes, horas: horasRestantes, ts, minutosJornada })
                  year.diasATrabajar += mes.diasATrabajar
                  year.mediosDiasATrabajar += mes.mediosDiasATrabajar
                  year.diasOtros += mes.diasOtros

                  year.minutosGuardia += mes.minutosGuardia
                  year.minutosATrabajar += mes.minutosATrabajar
                  year.minTrabajadosMenosGuardias += mes.minTrabajadosMenosGuardias
                  if (i > 0) { //ignore current month
                      year.acumuladoHastaMesAnterior += mes.minutosATrabajar - mes.minTrabajadosMenosGuardias
                  }
              } else {
                  year.months.push({ nombre: nombreMes, horas: 'sin cargar', ts, minutosJornada })
              }
          }
      }
      return year
  }
  getRandomInt(min, max) {
      return Math.floor(Math.random() * (max - min)) + min;
  }
  static get timeIcon() { return '<div class="TimeSpinner" style="display:inline-flex;margin:0 5px 3px 0;border-color:inherit"><div class="TimeSpinner__fill" style="color:#f6f6f6"></div></div>' }
}
new Bamboonomix()