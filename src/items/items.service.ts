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

async findAll(search?: string, location?: string, category?: string, status?: string) {
    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (location) {
      whereClause.location = { contains: location, mode: 'insensitive' };
    }

    if (category) {
      whereClause.category = { equals: category, mode: 'insensitive' };
    }

    if (status) {
      if (status === 'encontrado') {
        whereClause.status = { in: ['ENCONTRADO', 'encontrado', 'found', 'FOUND', 'Encontrado'] };
      } else if (status === 'perdido') {
        whereClause.status = { in: ['PERDIDO', 'perdido', 'lost', 'LOST', 'Perdido'] };
      }
    }

    return await this.prisma.item.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
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