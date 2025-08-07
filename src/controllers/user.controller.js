import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnClodinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';


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


export {registerUser,}