import { Component } from '@angular/core';
import { NavController, NavParams } from 'ionic-angular';
import { TabsPage } from '../tabs/tabs';
import { GlobalStateService } from '../../services/global-state.service';
import { CustomAuthorizerClient } from "../../services/aminalz-api.service";
import { Logger } from '../../services/logger.service';
import { Platform } from 'ionic-angular';
import { ImagePicker } from 'ionic-native';
import { Config } from '../../config/config'
import { CognitoUtil }        from '../../services/account-management.service';
import { AccountSigninPage } from '../account-signin/account-signin';
import { AccountSignupPage } from '../account-signup/account-signup';


declare const AWS: any;

@Component({
  templateUrl: 'resource-add.html',
})

export class UploadResourcesPage {
  tabsPage = TabsPage;
  location = null;
  platform : Platform;
  cognitoUtil = null;
  accountSigninPage = AccountSigninPage;
  accountSignupPage = AccountSignupPage;

  imageUploadEventListenerAttached = false;
  profileImageURI = `https://s3-${Config.REGION}.amazonaws.com/${Config.PROFILE_IMAGES_S3_BUCKET}/test.jpg`;
  profileImageDisplay = false;
  submitted: boolean = false;

  public formData = {
    resourceType: "",
    processingInstructions: "",
    tags: "",
    description: "",
    resourcefile: ""

  };


  loader: any;

  onSubmit(form) {
  console.log("Form:",form);
    this.submitted = true;
    if (form) {
      this.addResource(form);
    } else {
      console.log("form is not valid");
    }
  }

  addResource(form) {
    this.submitted = true;
    console.log("adding resource");
    if (form && this.formData.resourcefile) {

    let cognitoUserName = null;

    try {
        cognitoUserName = CognitoUtil.getUsername();
        console.log("Cognito USER name: " + cognitoUserName);
      } catch (e) {
        console.log(`Unable to retrieve user's session info from localStorage`);
        console.log(e);
      }

      let resource = {
        resourceType: this.formData.resourceType,
        processingInstructions: this.formData.processingInstructions,
        tags: this.formData.tags,
        description: this.formData.description,
        resourcefile: this.formData.resourcefile,
        name: cognitoUserName
      };
      let input = {
        input: resource
      };
      this.globals.displayLoader("Adding...");
      console.log("resource:", resource);
      this.customAuthClient.getClient().resourcesCreate("77812650-00b6-11e7-b638-7703a6651896", resource).subscribe(
        () => {
          this.globals.dismissLoader();
          this.globals.displayToast(`Resource successfully added.`);
          this.navCtrl.pop();
          this.navCtrl.push(UploadResourcesPage);
        },
        (err) => {
          this.globals.dismissLoader();
          this.globals.displayAlert('Error encountered',
            `Attempt to add resource failed. An error occurred. Please check the console logs for more information.`);
          console.log(err);
        }
      );
    }
  }

// code from: http://stackoverflow.com/questions/29644474/how-to-be-able-to-convert-image-to-base64-and-avoid-same-origin-policy
  convertImgToBase64URL(url, callback, outputFormat) {
    let img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function () {
      let canvas = document.createElement('CANVAS');
      let cvs = (<any>canvas);
      let ctx = cvs.getContext('2d');
      cvs.height = this.height;
      cvs.width = this.width;
      ctx.drawImage(this, 0, 0);
      let dataURL = cvs.toDataURL(outputFormat);
      callback(dataURL);
      canvas = null;
    };
    img.src = url;
    return url;
  }

  dataURItoBlob(dataURI) {
    // code adapted from: http://stackoverflow.com/questions/33486352/cant-upload-image-to-aws-s3-from-ionic-camera
    let binary = atob(dataURI.split(',')[1]);
    let array = [];
    for (let i = 0; i < binary.length; i++) {
      array.push(binary.charCodeAt(i));
    }
    return new Blob([new Uint8Array(array)], {type: 'image/jpeg'});
  };

  generateHash(str) {
    // code adapted from: https://github.com/darkskyapp/string-hash
    let hash = 5381, i = str.length
    while (i) {
      hash = (hash * 33) ^ str.charCodeAt(--i)
    }
    return hash >>> 0;
  }

  uploadFileToS3(file, key) {
    Logger.heading('Uploading resource to S3');
   // let cognitoUser = CognitoUtil.getCognitoUser();
  //  console.log("In s3:...... COGNITO USER: " + cognitoUser);
    this.globals.displayLoader('Uploading resource to Amazon S3...', 10000);
    let bucketName = Config.PROFILE_IMAGES_S3_BUCKET;
    console.log(`Attempting image upload to ${bucketName}/${key}`);
    console.log("creating s3 bucket");
    let s3bucket = new AWS.S3({region: Config.REGION, params: {Bucket: bucketName}});
    let metadata ={'albumid': 'aminalz/photos', 'userid': 'aminalz'};
    let params = {Key: key, Body: file, Metadata: metadata};

    s3bucket.upload(params, (err, data)=> {
      this.globals.dismissLoader();
      if (err) {
        let errorMessage = `Error uploading resource to S3: ${err}`
        this.globals.displayAlert('Error encountered', errorMessage);
        console.log(errorMessage);
        console.log(err);
      } else {
        console.log(`Successfully uploaded resource to S3.`);
        console.log(`resource identifier is: ` + this.formData.resourcefile);
        this.profileImageURI = `https://s3.amazonaws.com/${Config.PROFILE_IMAGES_S3_BUCKET}/${key}`;
        this.formData.resourcefile=this.profileImageURI
        console.log(`Image can be viewed at: ${this.profileImageURI}`)
        this.profileImageDisplay = true;
        console.log("calling submit...");

        this.onSubmit(this.formData);
      }
    });
  }


  selectImage() {
      // display a different FileSelector experience,
      // depending on whether the app is running on a mobile phone or a web browser
      if (this.platform.is('cordova')) {
        this.selectImageUsingNativeImageSelector();
      } else {
        this.selectImageUsingBrowserFileSelector();
      }
    }

    selectImageUsingBrowserFileSelector() {
      let selectedFiles : any = document.getElementById('imageUpload');
      let files = selectedFiles.files;
      if (selectedFiles.value !== '' && files.length > 0) {
        let filename = this.generateUniqueFilenameForS3Upload(files[0].name);
        this.uploadFileToS3(files[0], filename);
      } else {
        this.globals.dismissLoader();
        let errorMessage = 'Please select an image to upload first.';
        this.globals.displayAlert('Error encountered', errorMessage);
        console.log(errorMessage);
      }
      // reset the file selector UI
      let imageUploadFormSubmit : any = document.getElementById('imageUploadSubmit');
      imageUploadFormSubmit.style.visibility = 'hidden';
      this.formData.resourcefile=files[0];
    }

    generateUniqueFilenameForS3Upload(originalFilename) : string {
      console.log(originalFilename);
      return `${this.globals.getUnencodedUserId()}/${this.generateHash(originalFilename)}-${(new Date()).getTime()}.${originalFilename.split('.').pop()}`;
    }
    selectImageUsingNativeImageSelector() {
      console.log("selectImageUsingNativeImageSelector");
      Logger.heading('Displaying ImageSelector');
      // this.profileImageURI = 'https://s3-${Config.PROFILE_IMAGES_S3_BUCKET_REGION}.amazonaws.com/${Config.PROFILE_IMAGES_S3_BUCKET}/test.jpg'; // TODO
      try {
        let options = {
          maximumImagesCount: 1,
          width: 200,
          height: 200,
          quality: 100
        }
        // code adapted from: http://blog.ionic.io/ionic-native-accessing-ios-photos-and-android-gallery-part-2/
        ImagePicker.getPictures(options)
        .then(
          file_uris => {
            try {
              if (file_uris !== null && file_uris !== '' && (file_uris.length > 0)) {
                console.log(`Image selected: [${file_uris}]`);
                console.log(`Converting to Base64 image`);
                this.convertImgToBase64URL(file_uris[0], base64Img=>{
                  // console.log(base64Img);
                  console.log('Converting to Blob');
                  let blob = this.dataURItoBlob(base64Img);
                  // generate a unique filename
                  let filename = this.generateUniqueFilenameForS3Upload(file_uris[0]);
                  this.uploadFileToS3(blob, filename);
                }, null);
              }
            } catch (err) {
              throw(err);
            }
          },
          err => {
            throw err;
          }
        );
      } catch (err) {
        this.globals.dismissLoader();
        let errorMessage = 'Could not retrieve an image using the ImagePicker';
        this.globals.displayAlert('Error encountered', errorMessage);
        console.log(errorMessage);
        console.log(err);
      }
    }

    attachImageUploadEventListener() {
      if (this.platform.is('cordova')) {
        // Check If Cordova/Mobile. If it's mobile, then exit,
        // since this feature only applies to the Web experience, not mobile.
        // This event listener is a browser UI workaround, so that
        // we don't have to use the browser's standard, non-attractive FileSelector control
        return;
      }
      // check if the eventListener was already previously attached
      if (this.imageUploadEventListenerAttached) {
        console.log("listener was attached - i would have returned but i'm not going to");
       // return;
      }
      // console.log("Attaching event listener...");
      let imageUploadFormField : any = document.getElementById('imageUpload');
      let imageUploadFormSubmit : any = document.getElementById('imageUploadSubmit');

      // try again later if the DOM isn't fully ready yet
      if (imageUploadFormField == null) {
        return;
      }
      this.imageUploadEventListenerAttached = true;
      console.log("imageUploadEventListenerAttached set to true");
      imageUploadFormField.addEventListener('change', function( e ) {
        let fileName = e.target.value.split( '\\' ).pop();
        if (fileName === null || fileName === '') {
          // reset the file selector UI
          let imageUploadFormSubmit : any = document.getElementById('imageUploadSubmit');
          imageUploadFormSubmit.style.visibility = 'hidden';
        } else {
          // select your implementation approach (show upload button or not?)
          let showUploadButton = false;
          if (showUploadButton) {
            imageUploadFormSubmit.querySelector('span').innerHTML = `UPLOAD (${fileName})`;
            imageUploadFormSubmit.style.visibility = 'visible';
          } else {
            // simulate the Upload button being selected
            var evObj = document.createEvent('Events');
            evObj.initEvent('click', true, false);
            imageUploadFormSubmit.dispatchEvent(evObj)
          }
        }
      });
    }

  constructor(public navCtrl: NavController, public navParams: NavParams, private globals: GlobalStateService, private customAuthClient: CustomAuthorizerClient, platform: Platform) {
    this.location = "77812650-00b6-11e7-b638-7703a6651896";
    this.platform = platform;
    this.cognitoUtil = new CognitoUtil();
  }

  ionViewDidEnter() {
    Logger.banner("Add a Resource");
    console.log("attaching image upload event listener");
    this.attachImageUploadEventListener();

  }
}
