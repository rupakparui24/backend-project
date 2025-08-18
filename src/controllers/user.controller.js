import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnClodinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken'

const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();


        user.refreshToken = refreshToken; // Update the user's refresh token in the database
        await user.save({validateBeforeSave:  false}); // Save the user to update the refresh token in the database

        return { accessToken, refreshToken };
        
    } catch (error) {
        console.error("Error generating tokens:", error);
        throw new ApiError(500, "Internal server error while generating tokens");
    }
}


const registerUser = asyncHandler(async (req, res) => {
  // Handle user registration logic here
  // get user data from front end
  // validation - check for required fields
  // check for unique user using username and email
  // check for images and avatar
  // upload them to cloudinary, check for avatar
  // create user object - in db
  // remove password and refresh token field from response
  // check for successfull user creation
  // send response to client

  const { username, email, fullname, password } = req.body;
  console.log("email: ", email);

  if ([fullname, email, password, username].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const existingUser = await User.findOne({
    $or: [{ username }, { email }]
  });
    if (existingUser) {
        throw new ApiError(400, "Username or email already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const avatarLocalPath = Array.isArray(req.files?.avatar) && req.files.avatar.length > 0 ? req.files.avatar[0].path : undefined;  //was given by gpt, when i didn't uploaded images
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;   //this is working like avatar which is required, but it is not required, so when we are not sending any cover image it will throw an error.
    // const coverImageLocalPath = req.files?.coverImage?.[0]?.path || ""; // Optional cover image; this is given by gpt, will also work
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;   
    }
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }
    // console.log("Uploading avatar from path:", avatarLocalPath);
    const avatar = await uploadOnClodinary(avatarLocalPath);
    // console.log("Avatar upload result:", avatar);
    // const coverImage = await uploadOnClodinary(coverImageLocalPath); //was throwing error
    let coverImage;
    if (coverImageLocalPath) {
        coverImage = await uploadOnClodinary(coverImageLocalPath);
    }
    if (!avatar) {
        throw new ApiError(500, "Failed to upload avatar");
    }


    const user = await User.create({
        username : username.toLowerCase(),
        email,
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        password,
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );
    if (!createdUser) {
        throw new ApiError(500, "Failed to create user");
    }

    return res.status(201).json(
        new ApiResponse(
            200,
            createdUser,
            "User registered successfully"
        )
    )

});

const loginUser = asyncHandler(async (req, res) => {
    //get user data from front end
    //validate either using email or username
    //check for user in db
    //check for password match
    //generate access token and refresh token
    //send response to client in cookies

    //get user data from front end
    const {username, email, password} = req.body;

    //validate either using email or username
    if(!username && !email) {
        throw new ApiError(400, "Username or email is required");
    }

    //check for user in db
    const user = await User.findOne({
        $or : [{username}, {email}]
    });
    if(!user) {
        throw new ApiError(404, "User not found");
    }

    //check for password match
    const isPasswordMatch = await user.isPasswordCorrect(password);
    if(!isPasswordMatch) {
        throw new ApiError(401, "Invalid password");
    }

    //generate access token and refresh token
    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    const options = {
        httpOnly : true,
        secure : true,
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {user: loggedInUser, accessToken, refreshToken},
                "User logged in successfully"
            )
        );

    
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        { 
            $set: {"refreshToken" : undefined }
        },
        { new: true}
    )

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(
                200,
                null,
                "User logged out successfully"
            )
        );

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?.id).select("-password -refreshToken");
        if(!user) {
            throw new ApiError(404, "User not found");
        }
        if(user?.refreshToken !== incomingRefreshToken) {
            throw new ApiError(401, "Refresh token expired or used");
        }
        const options = {
            httpOnly: true,
            secure: true,
        };
        const { accessToken, newRefreshToken } = await generateAccessTokenAndRefreshToken(user._id);
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken : newRefreshToken },
                    "Access token refreshed successfully"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
    
})

const changeCurrentPassword = asyncHandler(async(req, res)=> {
    const {oldPassword, newPassword} = req.body;
    const user =  await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect){
        throw new ApiError(401, "Old password is incorrect");
    }
    user.password = newPassword;
    await user.save({validateBeforeSave: false});
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "Password changed successfully"
        )
    );
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            req.user,
            "Current user fetched successfully"
        )
    )
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullname, email} = req.body;
    if (!fullname || !email) {
        throw new ApiError(400, "Fullname and email are required");
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email: email
            }
        },
        {new : true}
    ).select("-password");
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "Account details updated successfully"
            )
        );
})

const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }
    const avatar = await uploadOnClodinary(avatarLocalPath);
    if (!avatar.url) {
        throw new ApiError(500, "Failed to upload avatar");
    }

    //TODO: delete old avatar from cloudinary if exists
    // const oldAvatar = req.user?.avatar; // Assuming you have the old avatar URL in req.user
    // if (oldAvatar) {
    //     await deleteFromCloudinary(oldAvatar);
    // }
    
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { avatar: avatar.url}
        },
        {new : true}
    ).select("-password");
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "Avatar updated successfully"
            )
        );
    
})

const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image is required");
    }
    const coverImage = await uploadOnClodinary(coverImageLocalPath);
    if (!coverImage.url) {
        throw new ApiError(500, "Failed to upload cover image");
    }
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { coverImage: coverImage.url}
        },
        {new : true}
    ).select("-password");
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "Cover image updated successfully"
            )
        );
})




export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateAvatar,
    updateCoverImage,

}