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
       //file uploaded successfully
        //console.log('File uploaded successfully:', uploadResult.url);  // used it for debugging
        fs.unlinkSync(localFilePath); // Delete the file after upload
        return uploadResult;
    } catch (error) {
        fs.unlinkSync(localFilePath); // Delete the file if upload fails
        return null;
    }
}
    // Function to delete a file from Cloudinary using  its url
const deleteFromCloudinary = async (fileUrl) => {
    try {
        if (!fileUrl) {
            throw new Error('No file URL provided');
        }
        // Extract public ID with folder support
        // Example: https://res.cloudinary.com/<cloud_name>/image/upload/v1234567890/avatars/filename.jpg
        const url = new URL(fileUrl);
        const pathParts = url.pathname.split('/');
        // Find the index of 'upload' and get everything after it except the extension
        const uploadIndex = pathParts.findIndex(part => part === 'upload');
        const publicIdWithExt = pathParts.slice(uploadIndex + 1).join('/');
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ""); // Remove extension
        const deleteResult = await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
        return deleteResult;
    } catch (error) {
        console.error('Error deleting file from Cloudinary:', error);
        return null;
    }
}

export {uploadOnClodinary, deleteFromCloudinary};