import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import { memoryStorage, MulterError } from 'multer';
import { MAX_UPLOAD_BYTES } from '../domain';

export const uploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
};

@Catch(MulterError)
export class UploadExceptionFilter implements ExceptionFilter {
  catch(error: MulterError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : 'File was rejected';
    response.status(400).json({ message, statusCode: 400 });
  }
}

export function requireFile(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file?.buffer?.length) {
    throw new BadRequestException('File is required');
  }
  return file;
}
