import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ItemsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async create(data: any, file?: any) {
    let uploadedUrl = null;

    if (file) {
      try {
        const uploadResult = await this.cloudinary.uploadImage(file);
        uploadedUrl = uploadResult.secure_url;
      } catch (error) {
        throw new BadRequestException('Error al subir la imagen a Cloudinary');
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
      },
    });
  }

  async findAll() {
    return this.prisma.item.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.item.findUnique({
      where: { id },
    });
  }
}