const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class FacebookService {
  constructor() {
    this.baseUrl = 'https://graph.facebook.com/v21.0';
    this.pageId = process.env.FACEBOOK_PAGE_ID;
    this.pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    
    console.log('FB PAGE ID:', this.pageId);
  console.log('FB TOKEN (first 10 chars):', this.pageAccessToken?.slice(0, 10));
  }

  

  async postToPage(postData) {
    try {
      const { message, link, scheduledPublishTime } = postData;
      let url = `${this.baseUrl}/${this.pageId}/feed`;
      
      const params = new URLSearchParams({
        access_token: this.pageAccessToken,
        message: message || '',
        link: link || ''
      });

      if (scheduledPublishTime) {
        params.append('scheduled_publish_time', Math.floor(new Date(scheduledPublishTime).getTime() / 1000));
        params.append('published', 'false');
      }

      const response = await axios.post(`${url}?${params.toString()}`);
      logger.info('Successfully posted to Facebook page', { postId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Error posting to Facebook page', { error: error.response?.data || error.message });
      throw new Error(error.response?.data?.error?.message || 'Failed to post to Facebook page');
    }
  }

  async uploadMedia(file, description = '') {
    try {
      const formData = new FormData();
      formData.append('source', fs.createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype
      });
      formData.append('description', description);

      const response = await axios.post(
        `${this.baseUrl}/${this.pageId}/photos`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${this.pageAccessToken}`
          },
          params: {
            published: 'false'
          }
        }
      );

      logger.info('Successfully uploaded media to Facebook', { mediaId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Error uploading media to Facebook', { error: error.response?.data || error.message });
      throw new Error(error.response?.data?.error?.message || 'Failed to upload media to Facebook');
    }
  }

  async getPagePosts(limit = 10) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.pageId}/feed`,
        {
          params: {
            access_token: this.pageAccessToken,
            fields: 'id,message,created_time,permalink_url,full_picture,attachments{media,type,url}',
            limit: limit
          }
        }
      );
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching Facebook page posts', { error: error.response?.data || error.message });
      throw new Error(error.response?.data?.error?.message || 'Failed to fetch Facebook page posts');
    }
  }

  async deletePost(postId) {
    try {
      const response = await axios.delete(
        `${this.baseUrl}/${postId}`,
        {
          params: {
            access_token: this.pageAccessToken
          }
        }
      );
      logger.info('Successfully deleted Facebook post', { postId });
      return { success: true };
    } catch (error) {
      logger.error('Error deleting Facebook post', { postId, error: error.response?.data || error.message });
      throw new Error(error.response?.data?.error?.message || 'Failed to delete Facebook post');
    }
  }
}

module.exports = new FacebookService();
