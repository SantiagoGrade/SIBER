/**
 * Inicialización segura: crea el Super Administrador solo si no existe ninguno.
 * La contraseña se toma de SEED_ADMIN_PASSWORD (variable de entorno); si falta,
 * se genera una aleatoria y se imprime UNA sola vez en consola.
 * Nunca hay credenciales predeterminadas en el código.
 */
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const existentes = await prisma.cuenta.count({ where: { rol: "SUPER_ADMIN" } });
  if (existentes > 0) {
    console.log("Ya existe un Super Administrador; no se crea otro.");
  } else {
    const correo = process.env.SEED_ADMIN_EMAIL ?? "admin@colmayor.edu.co";
    const password = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(12).toString("base64url");
    const generada = !process.env.SEED_ADMIN_PASSWORD;

    await prisma.cuenta.create({
      data: {
        usuario: correo.split("@")[0],
        correo: correo.toLowerCase(),
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        rol: "SUPER_ADMIN",
        nombreCompleto: "Super Administrador",
      },
    });
    console.log(`Super Administrador creado: ${correo}`);
    if (generada) {
      console.log(`Contraseña inicial (cámbiala al primer inicio de sesión): ${password}`);
    }
  }

  // Catálogos fijos de la institución (solo si están vacíos)
  if (await prisma.facultad.count() === 0) {
    await prisma.facultad.createMany({
      data: [
        ["fac_administracion", "Facultad de Administración"],
        ["fac_arquitectura_ingenieria", "Facultad de Arquitectura e Ingeniería"],
        ["fac_ciencias_salud", "Facultad de Ciencias de la Salud"],
        ["fac_ciencias_sociales_educacion", "Facultad de Ciencias Sociales y Educación"],
      ].map(([id, nombre]) => ({ id, nombre })),
    });
  }
}


main().finally(() => prisma.$disconnect());
