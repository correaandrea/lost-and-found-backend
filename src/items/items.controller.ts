import { Controller, Get, Post, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ItemsService } from './items.service';
import { Prisma } from '@prisma/client';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async createItem(
    @Body() body: Prisma.ItemCreateInput,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.itemsService.createItemWithImage(body, file);
  }

  @Get()
  async getItems() {
    return this.itemsService.findAllItems();
  }
}