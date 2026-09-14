import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ItemsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  /**
   * Uploads image to Cloudinary (if provided) and saves the item in Neon DB
   */
  async createItemWithImage(data: Prisma.ItemCreateInput, file?: Express.Multer.File) {
    let imageUrl = null;
    
    if (file) {
      const uploadedImage = await this.cloudinary.uploadFile(file);
      imageUrl = uploadedImage.secure_url;
    }

    return this.prisma.item.create({
      data: {
        ...data,
        imageUrl,
      },
    });
  }

  /**
   * Retrieves the 10 most recently reported items
   */
  async findAllItems() {
    return this.prisma.item.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
  }
}