<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import TableDetailModal from '@/componentes/modales/TableDetailModal.vue'
import { buildDetailFields } from '@/lib/nucleo/tableDetail'

const activeFilter = ref('todos')
const busqueda = ref('')
const materias = ref<any[]>([])
const loading = ref(true)

const PAGE_SIZE = 20
const paginaActual = ref(1)

const detalleVisible = ref(false)
const detalleTitle = ref('')
const detalleSubtitle = ref('')
const detalleFields = ref<{
  label:string
  value:string
  href?:string
}[]>([])

const filtros = [
  {id:'todos', label:'Todas'},
  {id:'1', label:'Semestre 1'},
  {id:'2', label:'Semestre 2'},
  {id:'3', label:'Semestre 3'},
  {id:'4', label:'Semestre 4'},
  {id:'5', label:'Semestre 5'},
  {id:'6', label:'Semestre 6'},
]

const verDetalleMateria = (materia: any) => {
  detalleTitle.value = materia.nombre || 'Materia'
  detalleSubtitle.value = materia.codigo ? `Código ${materia.codigo}` : ''
  detalleFields.value = buildDetailFields(materia, [
    { key: 'codigo', label: 'Código' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'semestre', label: 'Semestre' },
    { key: 'dia', label: 'Día' },
    { key: 'hora', label: 'Hora' },
    { key: 'profesor', label: 'Profesor' },

    { 
 key:'enlace_reunion',
 label:'Enlace reunión'
}

  ])
  detalleVisible.value = true
}

const cargarMaterias = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'materias'))

    materias.value = querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }))

  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}


onMounted(cargarMaterias)


const materiasFiltradas = computed(() => {

  let lista = materias.value

  if(activeFilter.value !== 'todos'){
    lista = lista.filter(
      m => m.semestre?.toString() === activeFilter.value
    )
  }


  if(busqueda.value.trim()){

    const texto = busqueda.value.toLowerCase()

    lista = lista.filter(m =>
      m.nombre?.toLowerCase().includes(texto) ||
      m.codigo?.toLowerCase().includes(texto) ||
      m.profesor?.toLowerCase().includes(texto)
    )
  }


  return lista
})


const totalPaginas = computed(() =>
  Math.max(
    1,
    Math.ceil(materiasFiltradas.value.length / PAGE_SIZE)
  )
)


const materiasPaginadas = computed(() => {

  const inicio =
    (paginaActual.value - 1) * PAGE_SIZE

  return materiasFiltradas.value.slice(
    inicio,
    inicio + PAGE_SIZE
  )

})


watch(
 [activeFilter,busqueda],
 ()=>{
   paginaActual.value = 1
 }
)


const irPagina = (pagina:number)=>{

 if(
   pagina >= 1 &&
   pagina <= totalPaginas.value
 ){
   paginaActual.value = pagina
 }

}

</script>

<template>

<div class="secretaria-list-page">

  <!-- BARRA DE BUSQUEDA Y FILTROS -->
  <section class="command-bar">

    <div class="search-box">

      <svg 
        class="search-icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>


      <input
        v-model="busqueda"
        class="search-input"
        type="search"
        placeholder="Buscar por código, materia o profesor..."
      />

    </div>


    <div class="filter-row">

      <button
        v-for="filtro in filtros"
        :key="filtro.id"
        type="button"
        :class="[
          'filter-chip',
          {active: activeFilter === filtro.id}
        ]"
        @click="activeFilter = filtro.id"
      >

        {{ filtro.label }}

      </button>

    </div>


  </section>



  <!-- TABLA -->

  <section class="table-section">


    <div 
      v-if="loading"
      class="loading-state"
    >

      <div class="spinner"></div>

      <span>
        Cargando materias...
      </span>

    </div>



    <div 
      v-else
      class="table-card"
    >



      <div class="table-card-header">

        <div>

          <h2 class="table-title">
            Lista de materias
          </h2>


          <p class="table-subtitle">

            {{ materias.length }} materias en el sistema ·

            {{ materiasFiltradas.length }} resultado{{ materiasFiltradas.length === 1 ? '' : 's' }}


            <template v-if="busqueda.trim()">

              para «{{ busqueda }}»

            </template>


          </p>


        </div>


      </div>





      <div class="table-wrap">


        <table class="data-table">


          <thead>

            <tr>

              <th>Código</th>

              <th>Materia</th>

              <th>Semestre</th>

              <th>Horario</th>

              <th>Profesor</th>

            </tr>


          </thead>



          <tbody>


            <tr

              v-for="materia in materiasPaginadas"

              :key="materia.id"

              class="row-clickable"

              @click="verDetalleMateria(materia)"

            >



              <td>

                <span class="code-badge">

                  {{ materia.codigo }}

                </span>

              </td>




              <td>

                <strong>

                  {{ materia.nombre }}

                </strong>

              </td>




              <td>


                <span class="semestre-badge">

                  Semestre {{ materia.semestre }}

                </span>


              </td>




              <td>


                <span class="hora-badge">

                  {{ materia.dia }} 
<br>
{{ materia.hora }}

                </span>


              </td>




              <td>

                {{ materia.profesor || 'Sin asignar' }}

              </td>




            </tr>



          </tbody>


        </table>


      </div>





      <!-- PAGINACION -->

      <div 
        v-if="materiasFiltradas.length > 0"
        class="table-footer"
      >


        <span>

          {{ materiasFiltradas.length }} materia{{ materiasFiltradas.length === 1 ? '' : 's' }}

          · Página {{ paginaActual }} de {{ totalPaginas }}

        </span>




        <div class="pagination-controls">


          <button

            type="button"

            class="page-nav"

            :disabled="paginaActual <= 1"

            @click="irPagina(paginaActual - 1)"

          >

            Anterior

          </button>





          <button

            type="button"

            class="page-nav"

            :disabled="paginaActual >= totalPaginas"

            @click="irPagina(paginaActual + 1)"

          >

            Siguiente

          </button>



        </div>


      </div>



    </div>



  </section>




  <TableDetailModal

    :open="detalleVisible"

    :title="detalleTitle"

    :subtitle="detalleSubtitle"

    :fields="detalleFields"

    @close="detalleVisible = false"

  />


</div>


</template>

<style scoped>

.pagination-controls{
 display:flex;
 gap:12px;
}

.page-nav{
 padding:8px 16px;
 border-radius:10px;
 border:1px solid #e5e7eb;
 background:white;
 cursor:pointer;
}

.page-nav:hover{
 background:#f3f4f6;
}

.code-badge {
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-border-light);
  color: var(--color-text);
  padding: 3px 8px;
  border-radius: 6px;
}

.semestre-badge {
  font-size: 11px;
  font-weight: 500;
  background: var(--color-warning-bg);
  color: var(--color-warning);
  padding: 3px 10px;
  border-radius: 20px;
}

.hora-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  background: var(--color-info-bg);
  color: var(--color-info);
  padding: 3px 10px;
  border-radius: 20px;
}

.secretaria-list-page{
  width:100%;
}


/* BARRA SUPERIOR */

.command-bar{
  background:white;
  border:1px solid #e5e7eb;
  border-radius:16px;
  padding:18px;
  margin-bottom:18px;
}


.search-box{
  position:relative;
  width:100%;
}


.search-icon{
  position:absolute;
  left:16px;
  top:50%;
  transform:translateY(-50%);
  color:#94a3b8;
}


.search-input{
  width:100%;
  height:44px;
  border:1px solid #e5e7eb;
  border-radius:12px;
  padding-left:45px;
  font-size:14px;
  outline:none;
}


.search-input:focus{
  border-color:#1e293b;
}



/* FILTROS */

.filter-row{
  display:flex;
  gap:10px;
  margin-top:16px;
  flex-wrap:wrap;
}


.filter-chip{

  border:none;
  background:#f1f5f9;
  color:#64748b;

  padding:9px 18px;

  border-radius:20px;

  cursor:pointer;

  font-size:14px;

  transition:.2s;

}


.filter-chip:hover{
  background:#e2e8f0;
}


.filter-chip.active{

  background:#111827;

  color:white;

}



/* TABLA */

.table-card{

 background:white;

 border:1px solid #e5e7eb;

 border-radius:16px;

 overflow:hidden;

}



.table-card-header{

 padding:22px;

 border-bottom:1px solid #e5e7eb;

}



.table-wrap{

 overflow-x:auto;

}



.data-table{

 width:100%;

 border-collapse:collapse;

}



.data-table th{

 text-align:left;

 padding:14px 18px;

 font-size:13px;

 color:#64748b;

 background:#f8fafc;

}



.data-table td{

 padding:14px 18px;

 border-bottom:1px solid #f1f5f9;

 font-size:14px;

}



.row-clickable{

 cursor:pointer;

}



.row-clickable:hover{

 background:#f8fafc;

}




/* AJUSTE COLUMNAS */

.data-table th:nth-child(1),
.data-table td:nth-child(1){

 width:110px;

}


.data-table th:nth-child(2),
.data-table td:nth-child(2){

 width:35%;

}


.data-table th:nth-child(3),
.data-table td:nth-child(3){

 width:120px;

}


.data-table th:nth-child(4),
.data-table td:nth-child(4){

 width:150px;

}



.data-table th:nth-child(5),
.data-table td:nth-child(5){

 width:25%;

}



/* BADGES */


.code-badge{

 background:#f1f5f9;

 color:#334155;

 padding:5px 10px;

 border-radius:8px;

 font-size:12px;

 font-weight:700;

}



.semestre-badge{

 background:#fff7ed;

 color:#ea580c;

 padding:5px 12px;

 border-radius:20px;

 font-size:12px;

}



.hora-badge{

 background:#eff6ff;

 color:#2563eb;

 padding:6px 12px;

 border-radius:20px;

 white-space:nowrap;

 font-size:12px;

}



.table-footer{

 display:flex;

 justify-content:space-between;

 align-items:center;

 padding:18px;

 border-top:1px solid #e5e7eb;

 color:#64748b;

}

</style>