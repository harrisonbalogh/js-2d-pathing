// Initializes scene switching header buttons

// ==================================================================================================================== Variables =====

// Color palette
var __color_background     = "rgb(44,54,64)";
var __color_foreground     = "rgb(234,236,238)";
var __color_text          = "rgb(234,236,238)";
var __color_tonic         = "rgb(0,102,153)";
var __color_mediant        = "rgb(0,119,180)";
var __color_dominant      = "rgb(51,153,204)";
var __color_accent        = "rgb(255,204,51)";
var __color_accent_backup  = "rgb(72,88,104)";

// ================================================================================================= Resizing Window Listener =========

window.onresize = () => {
  // Notify other classes (scenes) that window has been resized
  homeRefit();
};
