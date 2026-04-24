import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: true })
export class DashboardGateway {
  private readonly logger = new Logger(DashboardGateway.name);

  @WebSocketServer()
  server: Server;

  sendAlert(payload: any) {
    this.logger.log(`Sending high-match alert for project ${payload.project_id}`);
    this.server?.emit('alert', payload);
  }

  sendProjectUpdate(payload: any) {
    this.server?.emit('project_update', payload);
  }

  emitBackendActivity(snapshot: {
    phase: string;
    detail: string | null;
    current_project_id: number | null;
    errors: { at: string; message: string }[];
  }) {
    this.server?.emit('backend_activity', snapshot);
  }
}
