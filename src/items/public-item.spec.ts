import { toOwnerItem, toPublicItem } from './public-item';

describe('visibilidad del detalle privado', () => {
  const item = { id: 1, title: 'Celular', privateDetail: 'Pantalla rota en la esquina' };

  it('la versión pública oculta el detalle y solo indica que existe', () => {
    const result = toPublicItem(item);
    expect(result).not.toHaveProperty('privateDetail');
    expect(result.hasPrivateDetail).toBe(true);
    expect(JSON.stringify(result)).not.toContain('Pantalla rota');
  });

  it('indica que no hay detalle cuando es nulo o está vacío', () => {
    expect(toPublicItem({ id: 2, privateDetail: null }).hasPrivateDetail).toBe(false);
    expect(toPublicItem({ id: 3, privateDetail: '' }).hasPrivateDetail).toBe(false);
    expect(toPublicItem({ id: 4 }).hasPrivateDetail).toBe(false);
  });

  it('la versión del autor conserva el detalle', () => {
    expect(toOwnerItem(item)).toMatchObject({ privateDetail: 'Pantalla rota en la esquina', hasPrivateDetail: true });
  });

  it('no modifica el objeto original', () => {
    toPublicItem(item);
    expect(item.privateDetail).toBe('Pantalla rota en la esquina');
  });
});
