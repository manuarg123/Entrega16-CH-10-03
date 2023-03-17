import express from "express";
const router = express.Router();
import session from "express-session";
import bcrypt from "bcrypt";
import { Usuario } from "../modules/usuarios.modules.js";
import { Paciente } from "../modules/pacientes.modules.js";
import { HClinica } from "../modules/hclinicas.module.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import moment from "moment";
import multer from 'multer';
import fs from 'fs';
import path from "path";
import { fileURLToPath } from "url";
import logger from "../../logger.js";

const __filename = fileURLToPath(import.meta.url);
let __dirname = path.dirname(__filename);
__dirname = "/home/mrivas/Escritorio/Manu/";
//Configuro multer
const storage = multer.diskStorage({ 
  destination: function (req, file, cb) {
      let padre = req.params.id_paciente;
      let nombre = req.params.nombre_completo;
      let fecha = req.params.fecha_consulta;
      let fecha_format =  moment(req.params.fecha_consulta).add(1, 'days').format('YYYY-MM-DD');
      let ruta = path.join(__dirname) + fecha_format + nombre; 
      //Creo una carpeta con fecha y nombre paciente, si ya existe le sigue agregando adjuntos
      if(fs.existsSync(ruta)){
        cb(null, ruta)
      }else{
        fs.mkdirSync(ruta)
        cb(null, ruta)
      }
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
const upload = multer({ storage: storage })

/////////////////////////DESAFIO 16 - AGREGO UN LOGGER EN EL LOGIN /////////////////////////////////////////////////////////////
//Obtiene la ruta login. Si estaba logueado te redirige al index y sino al login para ingresar usuario/contraseña
router.get("/login", async (req, res) => {
  logger.info()
  if (req.session.login) {
    res.redirect("/api/usuario/login");
  } else {
    res.render("templates/login", { status: false });
  }
});
////////////////////////////////////////////////////////////////////

//Obtiene la ruta para registrarse.
router.get("/register", async (req, res) => {
  res.render("templates/register", { status: false });
});

router.post("/register", async (req, res) => {
  let body = req.body;

  let { nombre, email, password, rol } = body;

  let usuario = new Usuario({
    nombre,
    email,
    password: bcrypt.hashSync(password, 10),
    rol,
  });

  usuario.save();

  res.render("templates/finishregister");
});

/**
 * Cuando ingreso un usuario y contraseña los obtiene del body, para validarlos con los que tengo cargados en .env
 */
router.post("/login", async (req, res) => {
  let body = req.body;

  Usuario.findOne({ email: body.email }, (erro, usuarioDB) => {
    if (erro) {
      return res.status(500).json({
        ok: false,
        err: erro,
      });
    }

    //Verifica que exista un usuario con el mail escrito en el form
    if (!usuarioDB) {
      return res.status(400).json({
        ok: false,
        err: {
          message: "Usuario o contraseña incorrectos",
        },
      });
    }

    //Valida que la contraseña escrita por el usuario sea la almacenada en la base
    if (!bcrypt.compareSync(body.password, usuarioDB.password)) {
      return res.status(400).json({
        ok: false,
        err: {
          message: "Usuario o contraseña incorrectos",
        },
      });
    }

    dotenv.config();
    //Genera el token de autenticación con JWT
    let token = jwt.sign(
      {
        usuario: usuarioDB,
      },
      process.env.SEED_AUTENTICACION,
      {
        expiresIn: "24h",
      }
    );

    req.session.login = true;
    res.redirect("/api/usuario");
  });
});

//Obtiene la página inicial apenas entro al localhost, validada para habilitar inicio sesion
router.get("/", async (req, res) => {
  Paciente.find((err, listar_personas) => {
    if (err) {
      res.json({
        resultado: false,
        msj: "No se pudieron listar los pacientes",
        err,
      });
    } else {
      res.render("templates/home", {
        status: req.session.login,
        pacientes: listar_personas,
      });
    }
  });
});

//Cierra la sesion eliminando los datos y redifgiendo a página de logout
router.get("/logout", async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.json(err);
    } else {
      res.render("templates/logout", { status: false });
    }
  });
});

router.post("/paciente", async (req, res) => {
  let body = req.body;

  let {
    nombre,
    apellido,
    dni,
    fecha_nacimiento,
    direccion,
    localidad,
    email,
    telefono_1,
    telefono_2,
    obra_social,
    id_obra_social,
  } = body;

  let paciente = new Paciente({
    nombre,
    apellido,
    dni,
    fecha_nacimiento,
    direccion,
    localidad,
    email,
    telefono_1,
    telefono_2,
    obra_social,
    id_obra_social,
  });

  paciente.save();
  req.flash("success_msg", "Se agrego el paciente exitosamente");
  Paciente.find((err, listar_personas) => {
    if (err) {
      res.json({
        resultado: false,
        msj: "No se pudieron listar los pacientes",
        err,
      });
    } else {
      //Redirecciono para que cambie url y luego renderizo el home con los datos
      req.session.login = true;
      res.redirect("/api/usuario");
      res.render("templates/home", {
        status: true,
        pacientes: listar_personas,
      });
    }
  });
});

router.get("/form_paciente", (req, res) => {
  if (req.session.login) {
    res.render("templates/form_paciente", { status: req.session.login });
  } else {
    res.render("templates/login", { status: false });
  }
});

router.get("/pacientes/editar/:id", async (req, res) => {
  if (req.session.login) {
    if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      let paciente = await Paciente.findById(req.params.id);
      
      let nacimiento = moment(paciente.fecha_nacimiento).add(1, 'days').format('YYYY-MM-DD');
      
      res.render("templates/editar_paciente", {
        status: req.session.login,
        nacimiento : nacimiento,
        paciente
      });
    }
  } else {
    res.render("templates/login", { status: false });
  }
});

router.put("/pacientes/editar/:id", async (req, res) => {
  if (req.session.login) {
    let body = req.body;

    let {
      nombre,
      apellido,
      dni,
      fecha_nacimiento,
      direccion,
      localidad,
      email,
      telefono_1,
      telefono_2,
      obra_social,
      id_obra_social,
    } = body;

    await Paciente.findByIdAndUpdate(req.params.id, {
      nombre,
      apellido,
      dni,
      fecha_nacimiento,
      direccion,
      localidad,
      email,
      telefono_1,
      telefono_2,
      obra_social,
      id_obra_social,
    });
    Paciente.find((err, listar_personas) => {
      if (err) {
        res.json({
          resultado: false,
          msj: "No se pudieron listar los pacientes",
          err,
        });
      } else {
        //Redirecciono para que cambie url y luego renderizo el home con los datos
        req.session.login = true;
        res.redirect("/api/usuario");
        res.render("templates/home", {
          status: true,
          pacientes: listar_personas,
        });
      }
    });
  } else {
    res.render("templates/login", { status: false });
  }
});

router.delete("/pacientes/eliminar/:id", async (req, res) => {
  await Paciente.findByIdAndDelete(req.params.id);
  req.flash("error_msg", "Paciente eliminado exitosamente");
  Paciente.find((err, listar_personas) => {
    if (err) {
      res.json({
        resultado: false,
        msj: "No se pudieron listar los pacientes",
        err,
      });
    } else {
      //Redirecciono para que cambie url y luego renderizo el home con los datos
      req.session.login = true;
      res.redirect("/api/usuario");
      res.render("templates/home", {
        status: true,
        pacientes: listar_personas,
      });
    }
  });
});

router.get("/historias_clinicas/:id", async (req, res) => {
  if (req.session.login) {
    //Devuelve historias clinicas según el id
    HClinica.find({id_paciente:req.params.id},{},(err, listar_hclinicas) => {
      if (err) {
        res.json({
          resultado: false,
          msj: "No se pudieron listar las historias clinicas",
          err,
        });
      } else {
        res.render(`templates/historias_clinicas`, {
          status: req.session.login,
          id: req.params.id,
          hclinicas: listar_hclinicas,
        });
      }
    });
  } else {
    res.render("templates/login", { status: false });
  }
});
//////////////////////////MODIFIQUE DESDE ACA////////////////////////
/**
 * form_historias_clinicas
 */
router.get("/form_historias_clinicas/:paciente_id", async (req, res) => {
  if (req.session.login) {
    let paciente = await Paciente.findById(req.params.paciente_id);
    let nacimiento = moment(paciente.fecha_nacimiento).add(1, 'days').format('YYYY-MM-DD');
    let nombre_completo = paciente.nombre + " " + paciente.apellido;
    res.render("templates/form_historias_clinicas", {
      status: req.session.login,
      id: req.params.paciente_id,
      nacimiento: nacimiento,
      paciente,
      nombre_completo
    });
  } else {
    res.render("templates/login", { status: false });
  }
});

router.post("/historias_clinicas/:id_paciente", async (req,res) => {
    let body = req.body;

    if(req.session.login){
      let {
        id_paciente,
        fecha_consulta,
        nombre_completo,
        dni,
        motivos_consulta,
        condicion_actual,
        antecedentes_salud,
        comentarios
      } = body;

      let hclinica = new HClinica({
        id_paciente,
        fecha_consulta,
        nombre_completo,
        dni,
        motivos_consulta,
        condicion_actual,
        antecedentes_salud,
        comentarios
      });
    
      hclinica.save();

      req.flash("success_msg", "Se agrego la historia clínica exitosamente");
      HClinica.find({id_paciente:id_paciente},{},(err, listar_hclinicas) => {
        if (err) {
          res.json({
            resultado: false,
            msj: "No se pudieron listar las historias clinicas",
            err,
          });
        } else {
          //Redireccion la url para q no se rompa
          res.redirect(`${id_paciente}?_method=GET`);
          res.render(`templates/historias_clinicas`, {
            status: req.session.login,
            id: id_paciente,
            hclinicas: listar_hclinicas,
          });
        }
      });
    
    } else {
      res.render("templates/login", { status: false });
    }
});

router.delete("/hclinicas/eliminar/:id_paciente/:id", async (req, res) => {
  await HClinica.findByIdAndDelete(req.params.id);
  req.flash("error_msg", "Historia Clínica  eliminada exitosamente");

  HClinica.find({id_paciente:req.params.id_paciente},{},(err, listar_hclinicas) => {
    if (err) {
      res.json({
        resultado: false,
        msj: "No se pudieron listar las historias clinicas",
        err,
      });
    } else {
      //Redireccion la url para q no se rompa
      res.render(`templates/historias_clinicas`, {
        status: req.session.login,
        id: req.params.id_paciente,
        hclinicas: listar_hclinicas,
      });
    }
  });
  
});

router.get("/historia_clinica/editar/:id_paciente/:id", async (req, res) => {
  if (req.session.login) {
    if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      let paciente = await Paciente.findById(req.params.id_paciente);
      let hclinica = await HClinica.findById(req.params.id);
      
      let nacimiento = moment(paciente.fecha_nacimiento).add(1, 'days').format('YYYY-MM-DD');
      let f_consulta = moment(hclinica.fecha_consulta).add(1, 'days').format('YYYY-MM-DD');
      res.render("templates/editar_historias_clinicas", {
        status: req.session.login,
        nacimiento : nacimiento,
        f_consulta : f_consulta,
        id_paciente : req.params.id_paciente,
        paciente,
        hclinica
      });
    }
  } else {
    res.render("templates/login", { status: false });
  }
});

router.put("/historias_clinicas/editar/:id_paciente/:id", async (req, res) => {
  if (req.session.login) {
    let body = req.body;

    let {
      fecha_consulta,
      motivo_consulta,
      condicion_actual,
      antecedentes_salud,
      comentarios
    } = body;

    await HClinica.findByIdAndUpdate(req.params.id, {
      fecha_consulta,
      motivo_consulta,
      condicion_actual,
      antecedentes_salud,
      comentarios
    });

    HClinica.find({id_paciente:req.params.id_paciente},{},(err, listar_hclinicas) => {
      if (err) {
        res.json({
          resultado: false,
          msj: "No se pudieron listar las historias clinicas",
          err,
        });
      } else {
        //Redireccion la url para q no se rompa
        res.render(`templates/historias_clinicas`, {
          status: req.session.login,
          id: req.params.id_paciente,
          hclinicas: listar_hclinicas,
        });
      }
    });
  } else {
    res.render("templates/login", { status: false });
  }
});

//Subida de archivos
router.get('/subir_adjuntos/:nombre_completo/:fecha_consulta/:id_paciente/:id', async(req,res) => {
  if (req.session.login) {
    res.render("templates/subir_archivos", {id_paciente : req.params.id_paciente,
      id :req.params.id, nombre_completo: req.params.nombre_completo, fecha_consulta: req.params.fecha_consulta});
  } else {
    res.render("templates/login", { status: false });
  }
});

router.post('/subir_archivos/:nombre_completo/:fecha_consulta/:id_paciente/:id', upload.array('file', 5), function (req, res, next) {
  if (req.session.login) {
    res.render("templates/archivos_agregados")
  } else {
    res.render("templates/login", { status: false });
  }  
})

router.get('/ver_adjuntos/:nombre_completo/:fecha_consulta', function (req, res, next) {
  if (req.session.login) {
    let fecha_format =  moment(req.params.fecha_consulta).add(1, 'days').format('YYYY-MM-DD');
    let ruta = path.join(__dirname) + fecha_format + req.params.nombre_completo; 
    fs.readdir(ruta, function (err, files) {
      files.push(ruta);
      res.render('templates/descargar_archivos', {archivos: files, ruta})
    })
  } else {
    res.render("templates/login", { status: false });
  }  
})

router.get('/download/:ruta/:id',(req,res)=>{
  var x= ruta + req.params.id;
  res.download(x)
  
})

export default router;
