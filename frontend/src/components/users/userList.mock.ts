import type { UserResponse } from '../../services/api';
import type { UserListLoader } from '../../services/usersApi';

export const MOCK_USERS: UserResponse[] = [
	{ id: 101, full_name: 'María Fernanda Rojas', email: 'maria.rojas@correounivalle.edu.co', affiliation: 'Universidad del Valle', roles: ['ADMIN'], is_active: true, created_at: '2025-01-08T14:00:00Z' },
	{ id: 102, full_name: 'Carlos Andrés Muñoz', email: 'carlos.munoz@correounivalle.edu.co', affiliation: 'Universidad del Valle', roles: ['COMITE'], is_active: true, created_at: '2025-01-10T09:30:00Z' },
	{ id: 103, full_name: 'Laura Sofía Gómez', email: 'laura.gomez@icesi.edu.co', affiliation: 'Universidad Icesi', roles: ['AUTOR'], is_active: true, created_at: '2025-01-12T11:15:00Z' },
	{ id: 104, full_name: 'Julián Esteban Pérez', email: 'julian.perez@unal.edu.co', affiliation: 'Universidad Nacional de Colombia', roles: ['AUTOR'], is_active: true, created_at: '2025-01-15T16:20:00Z' },
	{ id: 105, full_name: 'Ana María Valencia', email: 'ana.valencia@javerianacali.edu.co', affiliation: 'Pontificia Universidad Javeriana Cali', roles: ['COMITE'], is_active: false, created_at: '2025-01-17T08:45:00Z' },
	{ id: 106, full_name: 'Diego Felipe Cárdenas', email: 'diego.cardenas@correounivalle.edu.co', affiliation: 'Universidad del Valle', roles: ['AUTOR'], is_active: true, created_at: '2025-01-20T13:10:00Z' },
	{ id: 107, full_name: 'Paula Andrea Castillo', email: 'paula.castillo@eafit.edu.co', affiliation: 'Universidad EAFIT', roles: ['ADMIN', 'AUTOR'], is_active: true, created_at: '2025-01-22T10:00:00Z' },
	{ id: 108, full_name: 'Santiago López Herrera', email: 'santiago.lopez@usc.edu.co', affiliation: 'Universidad Santiago de Cali', roles: ['AUTOR'], is_active: false, created_at: '2025-01-24T15:40:00Z' },
	{ id: 109, full_name: 'Valentina Ospina Ruiz', email: 'valentina.ospina@correounivalle.edu.co', affiliation: 'Universidad del Valle', roles: ['COMITE'], is_active: true, created_at: '2025-01-27T12:05:00Z' },
	{ id: 110, full_name: 'Mateo Giraldo Torres', email: 'mateo.giraldo@udea.edu.co', affiliation: 'Universidad de Antioquia', roles: ['AUTOR'], is_active: true, created_at: '2025-01-29T17:25:00Z' },
	{ id: 111, full_name: 'Daniela Pardo Silva', email: 'daniela.pardo@correounivalle.edu.co', affiliation: 'Universidad del Valle', roles: ['ADMIN'], is_active: true, created_at: '2025-02-01T08:30:00Z' },
	{ id: 112, full_name: 'Nicolás Restrepo Gil', email: 'nicolas.restrepo@icesi.edu.co', affiliation: 'Universidad Icesi', roles: ['AUTOR'], is_active: true, created_at: '2025-02-03T11:50:00Z' },
	{ id: 113, full_name: 'Camila Burbano Díaz', email: 'camila.burbano@javerianacali.edu.co', affiliation: 'Pontificia Universidad Javeriana Cali', roles: ['COMITE'], is_active: true, created_at: '2025-02-05T14:15:00Z' },
	{ id: 114, full_name: 'Andrés Felipe Quintero', email: 'andres.quintero@correounivalle.edu.co', affiliation: 'Universidad del Valle', roles: ['AUTOR'], is_active: false, created_at: '2025-02-08T09:05:00Z' },
];


// Enough committee members from the same institution to exercise two pages.
const committeeNames = ['Adriana Molina', 'Beatriz Salazar', 'Claudia Rivera', 'Eduardo Torres', 'Felipe Moreno', 'Gabriela Ruiz', 'Hector Vargas', 'Isabel Castro', 'Jorge Medina', 'Lucia Herrera', 'Oscar Rios', 'Patricia Leon'];
MOCK_USERS.push(...committeeNames.map((full_name, index): UserResponse => ({
  id: 200 + index, full_name, email: 'comite.' + (index + 1) + '@correounivalle.edu.co',
  affiliation: 'Universidad del Valle', roles: ['COMITE'], is_active: index !== 5,
  created_at: '2025-03-01T12:00:00Z',
})));

export const loadDemoUsers: UserListLoader = (signal) => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
  const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
  const timer = setTimeout(() => {
    signal.removeEventListener('abort', abort);
    resolve(MOCK_USERS.map((user) => ({ ...user, roles: [...user.roles] })));
  }, 300);
  signal.addEventListener('abort', abort, { once: true });
});
