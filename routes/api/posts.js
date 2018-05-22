const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const passport = require("passport");

// Load Validation
const validatePostInput = require("../../validation/post");

// Load Post model
const Post = require("../../models/Post");

// Load Profile model
const Profile = require("../../models/Profile");

// @route   GET api/posts/test
// @desc    Tests posts route
// @access  Public
router.get("/test", (req, res) => {
  return res.json({
    msg: "Posts Works"
  });
});

// @route   GET api/posts/
// @desc    Get all posts
// @access  Public
router.get("/", (req, res) => {
  Post.find()
    .sort({ date: -1 })
    .then(posts => res.json(posts))
    .catch(err => res.status(404).json({ nopostsfound: "No posts found" }));
});

// @route   GET api/posts/:id
// @desc    Get single post by id
// @access  Public
router.get("/:id", (req, res) => {
  Post.findById(req.params.id)
    .then(post => res.json(post))
    .catch(err =>
      res.status(404).json({ nopostfound: "No post found with that ID" })
    );
});

// @route   POST api/posts/
// @desc    Create post
// @access  Private
router.post(
  "/",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    const { errors, isValid } = validatePostInput(req.body);

    // Check validation
    if (!isValid) {
      return res.status(400).json(errors);
    }

    const newPost = new Post({
      text: req.body.text,
      name: req.body.name,
      avatar: req.body.avatar,
      user: req.user.id
    });
    // Save to DB
    newPost.save().then(post => res.json(post));
  }
);

// @route   DELETE api/posts/:id
// @desc    Delete post
// @access  Private
router.delete(
  "/:id",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    Profile.findOne({ user: req.user.id }).then(profile => {
      Post.findById(req.params.id)
        .then(post => {
          // Check that post owner is the logged in user
          if (post.user.toString() !== req.user.id) {
            // Status code 401 for unauthorized
            return res
              .status(401)
              .json({ notauthorized: "User not authorized" });
          }

          // Delete post
          post.remove().then(() => res.json({ sucess: true }));
        })
        .catch(err => res.status(404).json({ postnotfound: "No post found" }));
    });
  }
);

// @route   POST api/posts/like/:id
// @desc    Like post
// @access  Private
router.post(
  "/like/:id",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    Profile.findOne({ user: req.user.id }).then(profile => {
      Post.findById(req.params.id)
        .then(post => {
          // If user already liked this post
          if (post.likes.some(like => like.user.toString() === req.user.id)) {
            return res
              .status(400)
              .json({ alreadyliked: "User already liked this post" });
          }

          // Add user id to likes array
          post.likes.unshift({ user: req.user.id });

          // Save to DB
          post.save().then(post => res.json(post));
        })
        .catch(err => res.status(404).json({ postnotfound: "No post found" }));
    });
  }
);

// @route   POST api/posts/unlike/:id
// @desc    Unlike post
// @access  Private
router.post(
  "/unlike/:id",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    Profile.findOne({ user: req.user.id }).then(profile => {
      Post.findById(req.params.id)
        .then(post => {
          // If user has not liked this post, can't unlike it
          if (!post.likes.some(like => like.user.toString() === req.user.id)) {
            return res
              .status(400)
              .json({ notliked: "You have not yet liked this post" });
          }

          // Get index of like that matches user
          const removeIndex = post.likes
            .map(item => item.user.toString())
            .indexOf(req.user.id);

          // Splice the like out of array
          post.likes.splice(removeIndex, 1);

          // Save
          post.save().then(post => res.json(post));
        })
        .catch(err => res.status(404).json({ postnotfound: "No post found" }));
    });
  }
);

// @route   POST api/posts/comment/:id
// @desc    Add comment to post
// @access  Private
router.post(
  "/comment/:id",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    const { errors, isValid } = validatePostInput(req.body);

    // Check validation
    if (!isValid) {
      // If any errors, send 400 with errors object
      return res.status(400).json(errors);
    }

    // Find post and initialize comment object
    Post.findById(req.params.id)
      .then(post => {
        const newComment = {
          text: req.body.text,
          name: req.body.name,
          avatar: req.body.avatar,
          user: req.user.id
        };

        // Add to comments array
        post.comments.unshift(newComment);

        // Save
        post.save().then(post => res.json(post));
      })
      .catch(err => res.status(404).json({ postnotfound: "No post found" }));
  }
);

// @route   DELETE api/posts/comment/:post_id/:comment_id
// @desc    Remove comment from post
// @access  Private
router.delete(
  "/comment/:post_id/:comment_id",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    // Find post
    Post.findById(req.params.post_id)
      .then(post => {
        // Store array of comment
        const matchedComment = post.comments.filter(
          comment => comment._id.toString() === req.params.comment_id
        )[0];
        // If comment doesn't exist, reject
        if (!matchedComment) {
          return res
            .status(404)
            .json({ commentnotexists: "Comment does not exist" });
        }
        // If you're not the author of this comment, reject
        if (matchedComment.user.toString() !== req.user.id) {
          return res
            .status(401)
            .json({ usernotauthorized: "User not authorized" });
        }

        // Get remove index of comment
        const removeIndex = post.comments
          .map(item => item._id.toString())
          .indexOf(req.params.comment_id);

        // Splice comment out of array
        post.comments.splice(removeIndex, 1);

        // Save to DB
        post.save().then(post => res.json(post));
      })
      .catch(err => res.status(404).json({ postnotfound: "No post found" }));
  }
);

module.exports = router;
