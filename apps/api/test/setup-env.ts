import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../.env') });
process.env.FILE_STORAGE_DIR ??= resolve(__dirname, '../storage-test');
