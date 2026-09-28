import { Controller, Get, Post, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ItemsService } from './items.service';
import { Prisma } from '@prisma/client';
import { Param } from '@nestjs/common';

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

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return await this.itemsService.findOne(id);
  }
}