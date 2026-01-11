import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter to accept images, PDFs, and text files
const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',

    // PDF
    'application/pdf',

    // Text files
    'text/plain',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only images and PDF files are allowed.'
      )
    );
  }
};

// Configure upload settings
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5,
  },
});

// Generate unique filename preserving original name
export const generateFileName = (originalName: string): string => {
  // Sanitize filename to remove special characters but keep extension
  const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${uuidv4()}-${cleanName}`;
};
