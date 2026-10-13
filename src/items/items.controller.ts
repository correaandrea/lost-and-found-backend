import { Controller, Get, Post, Body, UploadedFile, UseInterceptors, Param, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ItemsService } from './items.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async createItem(
    @Body() body: any,
    @UploadedFile() file: any 
  ) {
    return this.itemsService.create(body, file);
  }

@Get()
  async findAll(
    @Query('search') search?: string,
    @Query('location') location?: string,
  ) {
    return await this.itemsService.findAll(search, location);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.itemsService.findOne(Number(id));
  }
}