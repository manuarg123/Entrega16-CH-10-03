import express from "express";
import { Connection } from "./config.js";
import dotenv from "dotenv";
import { engine } from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import mongoStore from "connect-mongo";
import userRouter from "./src/routes/user.js";
import pacienteRouter from "./src/routes/paciente.js";
import methodOverride from "method-override";
import flash from "connect-flash";
import hbs from "handlebars";
import moment from "moment";
import minimist from "minimist";
import { fork } from 'child_process';
import os from "os";
import logger from "./logger.js";
import loggerMiddleware from "./src/middlewares/routesLogger.middleware.js";

//Registro un helper para dar formato al tiempo dentro de handlebars
hbs.registerHelper('formatTime', function (date, format) {
    var mmnt = moment(date);
    return mmnt.format(format);
});

hbs.registerHelper("setVar", function(varName, varValue, options) {
    options.data.root[varName] = varValue;
});

const app = express();
const connection = new Connection();
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Conecto a la Base de datos y levanto la app
connection.connectMongoDB();

////////////////////DESAFIO 16 MIDDLEWARE //////////////////////7
app.use(loggerMiddleware);


////////////////////////////DESAFIO 14, INGRESAR PUERTO POR CONSOLA///////////////////////////////////////

const options = {
  alias: {
      "p": "PORT"
  },
  default: {
      "PORT": 8080
  }
};

const { PORT } = minimist(process.argv.slice(2), options);

const server = app.listen(PORT, () => {
  console.log(`Servidor conectado correctamente al puerto ${PORT}`);
});
server.on("error", (err) => console.log(err));


//////////////////////////////////////////////////////////////////////////////////////////////////////////

//Habilito carpeta para archivos estáticos como estilos
app.use(express.static("public"));

app.set("views", "./src/views");
app.set("view engine", "hbs");

//Define el motor de plantillas a utilizar
app.engine(
  "hbs",
  engine({
    extname: ".hbs",
    defaultLayout: "index.hbs",

    partialsDir: __dirname + "/src/views/partials",
  })
);

//Habilito la sesion para procesar el logueo
app.use(
  session({
    store: mongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      options: {
        userNewParser: true,
        useUnifiedTopology: true,
      },
    }),
    secret: process.env.SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 600000 }, //10 min.
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");

  next();
});

app.use("/api/usuario", userRouter);
app.use("/api/paciente", pacienteRouter);

app.get("/", (req, res) => {
  res.render("templates/home", {});
});

//////////////////////////////////////DESAFIO 15 Agrego el número de procesadores//////////////////////////

/**
 * Ruta /info con uso de process e información en json
 */
app.get('/info', (_req, res) => {
  const processInfo = {
    platform: process.platform,
    version: process.version,
    title: process.title,
    execPath: process.execPath,
    processId: process.pid,
    rss: process.memoryUsage().rss,
    numberOfProcessors: os.cpus().length
  };
  
  res.status(200).json(processInfo);
})

const randomNumbersGeneratorFork = fork('./src/functions/randomNumbersGenerator.js')

/**
 * Ruta para generar números randoms con child_process
 */
app.get('/randoms', (req, res) => {
  
  const cant = req.query.cant || 5000;
  
  randomNumbersGeneratorFork.on('message', (resultado) => {
      res.status(200).json(resultado);
  })
  randomNumbersGeneratorFork.send(cant);
  console.log('Lista generada')
})
////////////////////////////////////////////////////////////////////////////////////////////////////////