const express = require('express');
const router = express.Router();
const multer = require('multer');
const facebookService = require('../services/facebookService');
const logger = require('../utils/logger');



// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// Middleware to handle errors from multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'File upload error', message: err.message });
  } else if (err) {
    return res.status(400).json({ error: 'Error', message: err.message });
  }
  next();
};

// Create a new post
router.post('/posts', async (req, res, next) => {
  try {
    const { message, link, scheduledPublishTime } = req.body;

    if (!message && !link) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Either message or link is required' 
      });
    }

    const postData = { message, link };
    if (scheduledPublishTime) {
      postData.scheduledPublishTime = scheduledPublishTime;
    }

    const result = await facebookService.postToPage(postData);
    res.status(201).json({
      success: true,
      data: result,
      message: 'Post created successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Upload media
router.post('/media', 
  upload.single('media'),
  handleMulterError,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          error: 'Validation Error', 
          message: 'Media file is required' 
        });
      }

      const result = await facebookService.uploadMedia(
        req.file,
        req.body.description || ''
      );

      // Clean up the uploaded file
      const fs = require('fs');
      fs.unlink(req.file.path, (err) => {
        if (err) logger.error('Error deleting temporary file', { error: err });
      });

      res.status(201).json({
        success: true,
        data: result,
        message: 'Media uploaded successfully'
      });
    } catch (error) {
      // Clean up the uploaded file in case of error
      if (req.file) {
        const fs = require('fs');
        fs.unlink(req.file.path, (err) => {
          if (err) logger.error('Error deleting temporary file after error', { error: err });
        });
      }
      next(error);
    }
  }
);

// Get page posts
router.get('/posts', async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const posts = await facebookService.getPagePosts(parseInt(limit));
    
    res.status(200).json({
      success: true,
      count: posts.length,
      data: posts
    });
  } catch (error) {
    next(error);
  }
});

// Delete a post
router.delete('/posts/:postId', async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!postId) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Post ID is required' 
      });
    }

    await facebookService.deletePost(postId);
    res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
