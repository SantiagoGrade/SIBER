/**
 * Servidor SMTP real de captura para pruebas. Guarda los mensajes recibidos
 * para aserciones sobre destinatarios, asuntos, adjuntos y cantidad.
 */
import { SMTPServer, SMTPServerSession, SMTPServerAddress } from "smtp-server";
import { Readable } from "stream";

export interface MensajeCapturado {
  para: string[];
  de: string;
  datos: string;
}

export class SmtpCaptura {
  private server: SMTPServer | null = null;
  public mensajes: MensajeCapturado[] = [];
  private puerto: number;

  constructor(puerto = 3525) {
    this.puerto = puerto;
  }

  private crearServidor(): SMTPServer {
    return new SMTPServer({
      disabledCommands: ["AUTH", "STARTTLS"],
      onData: (stream: Readable, session: SMTPServerSession, cb: () => void) => {
        let datos = "";
        stream.on("data", (c) => (datos += c));
        stream.on("end", () => {
          this.mensajes.push({
            para: (session.envelope.rcptTo as SMTPServerAddress[]).map(r => r.address),
            de: (session.envelope.mailFrom as SMTPServerAddress | false)
              ? (session.envelope.mailFrom as SMTPServerAddress).address : "",
            datos,
          });
          cb();
        });
      },
    });
  }

  iniciar(): Promise<void> {
    // Se crea una instancia nueva cada vez: net.Server no re-listenea tras close()
    this.server = this.crearServidor();
    const s = this.server;
    return new Promise((resolve, reject) => {
      s.listen(this.puerto, () => resolve());
      s.on("error", reject);
    });
  }

  detener(): Promise<void> {
    const s = this.server;
    this.server = null;
    return new Promise(resolve => {
      if (!s) return resolve();
      s.close(() => resolve());
    });
  }

  limpiar() { this.mensajes = []; }

  mensajesPara(correo: string): MensajeCapturado[] {
    return this.mensajes.filter(m => m.para.includes(correo));
  }
}
