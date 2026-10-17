import { Controller, Get, Post, Body, UploadedFile, UseInterceptors, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ItemsService } from './items.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('image'))
  async createItem(@Body() body: any, @UploadedFile() file: any, @Req() req: any) {
    return this.itemsService.create(body, file, req.user.userId);
  }

  @Get()
  async findAll() {
    return this.itemsService.findAll();
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async findMyItems(@Req() req: any) {
    return this.itemsService.findMyItems(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.itemsService.findOne(Number(id));
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.itemsService.remove(Number(id), req.user.userId);
  }
}