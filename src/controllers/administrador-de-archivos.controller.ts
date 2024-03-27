import {
  get,
  HttpErrors,
  oas,
  param,
  post,
  Request,
  requestBody,
  Response,
  RestBindings
} from '@loopback/rest';

import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import {promisify} from 'util';
import {ConfiguracionGeneral} from '../config/configuracion.general';

const readdir = promisify(fs.readdir);

export class AdministradorDeArchivosController {
  constructor() { }

  @authenticate('admin')
  @post('/cargar-archivo-producto', {
    responses: {
      200: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
            },
          },
        },
        description: 'archivo a cargar',
      },
    },
  })
  async cargarArchivoProducto(
    @inject(RestBindings.Http.RESPONSE) response: Response,
    @requestBody.file() request: Request,
  ): Promise<object | false> {
    const filePath = path.join(__dirname, ConfiguracionGeneral.carpetaArchivosProductos);
    let res = await this.StoreFileToPath(
      filePath,
      ConfiguracionGeneral.campoDeProducto,
      request,
      response,
      ConfiguracionGeneral.extensionesImagenes,
    );
    if (res) {
      const filename = response.req?.file?.filename;
      if (filename) {
        return {
          filename: filename,
        };
      }
    }
    return res;
  }

  private GetMulterStorageConfig(path: string) {
    var filename: string = '';
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, path);
      },
      filename: function (req, file, cb) {
        filename = `${Date.now()}-${file.originalname}`;
        cb(null, filename);
      },
    });
    return storage;
  }

  private StoreFileToPath(
    storagePath: string,
    FieldName: string,
    request: Request,
    response: Response,
    acceptedExt: string[],
  ): Promise<object> {
    //console.log('storagePath', storagePath);

    return new Promise((resolve, reject) => {
      const storage = this.GetMulterStorageConfig(storagePath);
      //console.log('storage', storage);
      const upload = multer({
        storage: storage,
        fileFilter: function (req, file, callback) {
          var ext = path.extname(file.originalname).toLowerCase();
          console.log('ext', ext);
          if (acceptedExt.indexOf(ext)) {
            return callback(null, true)
          }
          return callback(
            new HttpErrors[400]('Solo se permiten archivos de tipo: ' + acceptedExt.join(', ')),
          );
        },
        //limitar peso, calidad
        limits: {},
      }).single(FieldName);
      upload(request, response, (err: any) => {
        if (err) {
          reject(err);
        }
        resolve(response);
      });
    });
  }

  /** Decarga de archivos */

  @get('/archivos/{type}', {
    responses: {
      200: {
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
        },
        description: 'Lista de archivos',
      },
    },
  })
  async ObtenerListaDeArchivos(@param.path.number('type') type: number) {
    const folderPath = this.ObtenerArchivosPorTipo(type);
    const files = await readdir(folderPath);
    return files;
  }

  @get('/ObtenerArchivo/{type}/{name}')
  @oas.response.file()
  async downloadFileByName(
    @param.path.number('type') type: number,
    @param.path.string('name') fileName: string,
    @inject(RestBindings.Http.RESPONSE) response: Response,
  ) {
    const folder = this.ObtenerArchivosPorTipo(type);
    const file = this.ValidarNombreDeArchivo(folder, fileName);
    response.download(file, fileName);
    return response;
  }

  private ObtenerArchivosPorTipo(tipo: number) {
    let filePath = '';
    switch (tipo) {
      //amusement
      case 1:
        filePath = path.join(__dirname, ConfiguracionGeneral.carpetaArchivosProductos);
        break;
      case 2:
        filePath = path.join(__dirname, ConfiguracionGeneral.carpetaArchivosClientes);
        break;
      case 3:
        break;
    }
    return filePath;
  }

  private ValidarNombreDeArchivo(folder: string, fileName: string) {
    const resolved = path.resolve(folder, fileName);
    if (resolved.startsWith(folder)) return resolved;
    // the resolved file is outside sandbox
    throw new HttpErrors[400](`Este archivo es invalido: ${fileName}`);
  }
}
