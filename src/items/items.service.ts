import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ItemsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async create(data: any, file: any, userId: number) {
    let uploadedUrl = null;
    if (file) {
      try {
        const uploadResult = await this.cloudinary.uploadImage(file);
        uploadedUrl = uploadResult.secure_url;
      } catch (error) {
        throw new BadRequestException('Error al subir la imagen');
      }
    }

    return this.prisma.item.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        location: data.location,
        status: data.status,
        imageUrl: uploadedUrl,
        userId: userId, // Asociamos el objeto al usuario
      },
    });
  }

  async findAll() {
    return this.prisma.item.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findMyItems(userId: number) {
    return this.prisma.item.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    return this.prisma.item.findUnique({ where: { id } });
  }

  async remove(id: number, userId: number) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new BadRequestException('Objeto no encontrado');
    if (item.userId !== userId) throw new UnauthorizedException('Solo puedes borrar tus propios objetos');

    return this.prisma.item.delete({ where: { id } });
  }
}