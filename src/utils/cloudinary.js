import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';

cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET
});
const uploadOnClodinary = async (localFilePath) => {
    try {
        if(!localFilePath) {
            throw new Error('No file path provided');
        }
        const uploadResult = await cloudinary.uploader
       .upload(
           localFilePath, {
               resource_type: 'auto',
           }
       )
        console.log('File uploaded successfully:', uploadResult.url);
        return uploadResult;
    } catch (error) {
        fs.unlinkSync(localFilePath); // Delete the file if upload fails
        return null;
    }
}

export {uploadOnClodinary};