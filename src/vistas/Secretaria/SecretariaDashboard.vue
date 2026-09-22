<script setup lang="ts">

import { ref, computed, onMounted, onUnmounted } from "vue";
import { collection, getDocs } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { obtenerSesion } from "@/lib/autenticacion/session";

import {
  subscribeSolicitudesDirector,
  type SolicitudDirector,
} from "@/lib/director/directorSolicitudesAggregate";

import {
  computarStatsDirector,
} from "@/lib/director/directorStats";

import { fetchMaterias } from "@/lib/dominio/materias";
import { primerosDosNombres } from "@/lib/nucleo/nombreCorto";


const nombreSecretaria = ref("Secretaria");


const stats = ref({
  total:0,
  pendientes:0,
  aprobadas:0,
  rechazadas:0
});


const solicitudesRecientes = ref<any[]>([]);
const proximosParciales = ref<any[]>([]);

const loading = ref(true);



const nombreSaludo = computed(()=>{

return primerosDosNombres(
  nombreSecretaria.value
) || "Secretaria";

});



const horaDelDia = computed(()=>{

const h = new Date().getHours();

if(h < 12) return "Buenos días";
if(h < 18) return "Buenas tardes";

return "Buenas noches";

});



const fechaHoy = computed(()=>{

return new Date().toLocaleDateString(
"es-CO",
{
weekday:"long",
year:"numeric",
month:"long",
day:"numeric"
}
);

});





const cargarParciales = async()=>{

try{

const snap = await getDocs(
collection(db,"parciales")
);


proximosParciales.value =
snap.docs
.map(d=>({
id:d.id,
...d.data()
}))
.slice(0,3);


}catch(error){

console.error(error);

}

};





const aplicarSolicitudes = (
lista: SolicitudDirector[]
)=>{


const resumen =
computarStatsDirector(lista);



stats.value={

total: resumen.total,

pendientes:
resumen.pendientes,

aprobadas:
resumen.aprobadas,

rechazadas:
resumen.rechazadas

};



solicitudesRecientes.value =
lista.slice(0,5)
.map(s=>({

id:s.id,

nombre:
s.nombre || "Usuario",

tipo:
s.tipo,

estado:
s.estado,


iniciales:
(s.nombre || "U")
.charAt(0)
.toUpperCase()

}));

};



let unsubscribe:
(()=>void)|null=null;




onMounted(async()=>{


const sesion =
await obtenerSesion();


if(sesion?.nombre){

nombreSecretaria.value =
sesion.nombre;

}



await cargarParciales();



const materias =
await fetchMaterias()
.catch(()=>[]);



unsubscribe =
subscribeSolicitudesDirector(

materias,

(lista)=>{

aplicarSolicitudes(lista);

loading.value=false;

},

()=>{

loading.value=false;

}

);


});




onUnmounted(()=>{

unsubscribe?.();

});


</script>



<template>


<div class="secretaria-dashboard">



<section class="hero-welcome">


<p class="fecha">
{{fechaHoy}}
</p>



<h1>
{{horaDelDia}},
{{nombreSaludo}}
</h1>



<p class="subtitle">
Panel administrativo · Secretaria académica
</p>




<router-link
to="/secretaria/solicitudes"
class="btn-principal"
>

📄

<span>
Gestionar solicitudes
</span>

</router-link>



</section>





<section class="stats-grid">


<div class="stat-card">

<div class="icon">
📄
</div>

<h2>
{{stats.total}}
</h2>

<p>
Total solicitudes
</p>

</div>




<div class="stat-card">

<div class="icon">
⏳
</div>

<h2>
{{stats.pendientes}}
</h2>

<p>
Pendientes
</p>

</div>





<div class="stat-card">

<div class="icon">
✓
</div>

<h2>
{{stats.aprobadas}}
</h2>

<p>
Aprobadas
</p>

</div>





<div class="stat-card">

<div class="icon">
✕
</div>

<h2>
{{stats.rechazadas}}
</h2>

<p>
Rechazadas
</p>

</div>



</section>







<div class="main-grid">





<section class="panel">


<div class="panel-header">

<h2>
Solicitudes recientes
</h2>


<router-link
to="/secretaria/solicitudes"
>
Ver todas →
</router-link>


</div>





<div
v-for="s in solicitudesRecientes"
:key="s.id"
class="solicitud"
>



<div class="avatar">

{{s.iniciales}}

</div>




<div>

<strong>
{{s.nombre}}
</strong>


<p>
{{s.tipo}}
</p>


</div>




<span>

{{s.estado}}

</span>



</div>



</section>








<div class="side-column">





<section class="panel">


<div class="panel-header">

<h2>
Calendario
</h2>


<router-link
to="/secretaria/calendario"
>
Ver →
</router-link>


</div>




<div
v-for="p in proximosParciales"
:key="p.id"
class="evento"
>


<strong>
{{p.materia}}
</strong>


<p>
{{p.fecha}}
</p>


</div>




</section>







<section class="panel">


<h2>
Accesos rápidos
</h2>



<div class="quick-grid">


<router-link
to="/secretaria/usuarios"
>
👥 Usuarios
</router-link>



<router-link
to="/secretaria/materias"
>
📚 Materias
</router-link>



<router-link
to="/secretaria/calendario"
>
📅 Calendario
</router-link>



<router-link
to="/secretaria/recursos"
>
📁 Recursos
</router-link>


</div>


</section>



</div>





</div>





</div>


</template>

<style scoped>

.secretaria-dashboard{
  width:100%;
  padding:32px;
  color:#0f172a;
}


/* HERO */

.hero-welcome{

  background:
  linear-gradient(
    135deg,
    #ffffff,
    #f8fafc
  );

  border-radius:24px;
  padding:32px;

  border:1px solid #e5e7eb;

  margin-bottom:28px;

}


.fecha{

  color:#64748b;
  font-size:14px;
  margin-bottom:12px;

}


.hero-welcome h1{

  font-size:36px;
  font-weight:800;
  margin:0 0 10px;

  letter-spacing:-1px;

}


.subtitle{

  color:#64748b;
  font-size:16px;

}




.btn-principal{

display:flex;

align-items:center;

gap:12px;

width:max-content;

margin-top:24px;

padding:14px 22px;

background:#111827;

color:white;

border-radius:14px;

text-decoration:none;

font-weight:600;

transition:.25s;

}



.btn-principal:hover{

transform:translateY(-2px);

opacity:.9;

}





/* ESTADISTICAS */


.stats-grid{

display:grid;

grid-template-columns:
repeat(4,1fr);

gap:20px;

margin-bottom:28px;

}




.stat-card{

background:white;

border-radius:20px;

padding:22px;

border:1px solid #e5e7eb;

box-shadow:
0 8px 25px rgba(0,0,0,.04);

transition:.25s;

}




.stat-card:hover{

transform:translateY(-4px);

}




.icon{

font-size:28px;

margin-bottom:12px;

}



.stat-card h2{

font-size:34px;

margin:0;

font-weight:800;

}



.stat-card p{

color:#64748b;

margin-top:8px;

}







/* CONTENIDO */

.main-grid{

display:grid;

grid-template-columns:
2fr 1fr;

gap:24px;

}




.panel{

background:white;

border-radius:22px;

padding:24px;

border:1px solid #e5e7eb;

box-shadow:
0 8px 25px rgba(0,0,0,.04);

}




.panel-header{

display:flex;

justify-content:space-between;

align-items:center;

margin-bottom:20px;

}



.panel-header h2,
.panel h2{

font-size:20px;

margin:0;

font-weight:750;

}




.panel-header a{

color:#2563eb;

text-decoration:none;

font-size:14px;

font-weight:600;

}







/* SOLICITUDES */


.solicitud{

display:flex;

align-items:center;

gap:14px;

padding:15px 0;

border-bottom:1px solid #f1f5f9;

}



.solicitud:last-child{

border-bottom:none;

}



.avatar{

width:42px;

height:42px;

border-radius:50%;

background:#e0e7ff;

display:flex;

align-items:center;

justify-content:center;

font-weight:700;

color:#3730a3;

}



.solicitud strong{

font-size:15px;

}



.solicitud p{

margin:4px 0 0;

color:#64748b;

font-size:14px;

}



.solicitud span{

margin-left:auto;

background:#f1f5f9;

padding:6px 12px;

border-radius:20px;

font-size:13px;

font-weight:600;

}








/* COLUMNA DERECHA */


.side-column{

display:flex;

flex-direction:column;

gap:24px;

}





.evento{

padding:14px;

border-radius:14px;

background:#f8fafc;

margin-top:12px;

}



.evento strong{

font-size:15px;

}



.evento p{

margin:5px 0 0;

color:#64748b;

}






/* ACCESOS */


.quick-grid{

display:grid;

grid-template-columns:
repeat(2,1fr);

gap:12px;

margin-top:18px;

}



.quick-grid a{

padding:16px;

border-radius:16px;

background:#f8fafc;

text-decoration:none;

color:#0f172a;

font-weight:600;

transition:.2s;

}



.quick-grid a:hover{

background:#e2e8f0;

transform:translateY(-2px);

}







@media(max-width:1100px){


.stats-grid{

grid-template-columns:
repeat(2,1fr);

}


.main-grid{

grid-template-columns:1fr;

}


}




@media(max-width:700px){


.secretaria-dashboard{

padding:16px;

}



.stats-grid{

grid-template-columns:1fr;

}


.hero-welcome h1{

font-size:28px;

}


}


</style>