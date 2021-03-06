// Profile page to display user details.

import React, { useState } from "react";
import { connect } from 'react-redux';
import { Link } from "react-router-dom";
import PropTypes from "prop-types";

import _ from "lodash";
import loadImage from "blueimp-load-image";

import CircularProgress from "@material-ui/core/CircularProgress";
import RootRef from "@material-ui/core/RootRef";
import { Icon } from "@material-ui/core";
import CheckIcon from "@material-ui/icons/Check";
import ClearIcon from "@material-ui/icons/Clear";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import Avatar from "@material-ui/core/Avatar";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import InputBase from "@material-ui/core/InputBase";

import PageWrapper from "./PageWrapper";
import MapLocation from "../types/MapLocation";
import { dbFirebase, authFirebase } from "features/firebase";
import User from "types/User";

import config from "custom/config";
// TODO: split the file

const AVATAR_SIZE = 100;
const MAX_AVATAR_SIZE = 512;
const styles = (theme) => ({
  avatar: {
    margin: 10,
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
  },
  row: {
    display: "flex",
    width: "100%",
    // padding: `0 ${theme.spacing(2)}px`
  },
  colr: {
    flex: "50%",
    textAlign: "right",
  },
  coll: {
    flex: "50%",
    textAlign: "left",
  },
  centered: {
    textAlign: "center",
  },
  wrapper: {
    margin: theme.spacing(1),
    position: "relative",
  },
  profileInfo: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    margin: "20px;",
  },
  avatarProgress: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -AVATAR_SIZE / 2,
    marginLeft: -AVATAR_SIZE / 2,
  },
  name: {
    fontSize: "1.6em",
  },
  textProgress: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -10,
    marginLeft: -10,
  },
});

const mapStateToProps = state => ({
  user: state.user,
  geojson: state.geojson
});

const ProfileTextField = connect(mapStateToProps)(withStyles(styles)(function (props) {
  const { user, className, fieldName, classes, maxLength, placeholder } = props;
  const originalFieldValue = user[fieldName] || "";

  const [updating, setUpdating] = useState(false);
  const [fieldValue, setFieldValue] = useState(originalFieldValue);

  const onBlur = async (event) => {
    console.log(fieldValue);
    console.log(originalFieldValue === fieldValue);
    const trimmedOld = _.trim(originalFieldValue);
    const trimmedNew = _.trim(fieldValue);
    if (trimmedOld !== trimmedNew) {
      setUpdating(true);

      try {
        const fields = {};
        fields[fieldName] = fieldValue;
        await dbFirebase.updateProfile(fields);
        await authFirebase.updateCurrentUser(fields);
      } catch (error) {
        setFieldValue(trimmedOld);
      } finally {
        setUpdating(false);
      }
    }
  };

  const onChange = (event) => {
    const newValue = event.target.value;
    console.log(newValue);
    setFieldValue(newValue);
  };

  return (
    <span className={classes.wrapper}>
      <InputBase
        disabled={updating}
        value={fieldValue}
        placeholder={placeholder}
        className={className}
        inputProps={{ style: { textAlign: "center" }, maxLength: maxLength }}
        onChange={onChange}
        onBlur={onBlur}
      />
      {updating && <CircularProgress size={20} className={classes.textProgress} />}
    </span>
  );
}));

class Profile extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      updatingPhoto: false,
      profileImg: null,
    };
    this.domRefInput = {};
  }

  calcUrl(feature) {
    const mapLocation = new MapLocation({
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      zoom: config.ZOOM_FLYTO
    });
    const urlFormated = mapLocation.urlFormated();
    return `${config.PAGES.displayPhoto.path}/${feature.properties.id}@${urlFormated}`;
  }

  handleAvatarClick = (e) => {
    this.domRefInput.current.click();
  };

  openFile = async (e) => {
    const imageFile = e.target.files[0];
    if (imageFile) {
      this.setState({ updatingPhoto: true });

      try {
        // reduce and save file
        const img = await loadImage(imageFile, {
          canvas: true,
          orientation: true,
          maxWidth: MAX_AVATAR_SIZE,
          maxHeight: MAX_AVATAR_SIZE,
        });

        const imgSrc = img.image.toDataURL("image/jpeg");
        this.setState({
          profileImg: imgSrc,
        });
        const base64 = imgSrc.split(",")[1];
        const avatarUrl = await dbFirebase.saveProfileAvatar(base64);
        await authFirebase.updateCurrentUser({ photoURL: avatarUrl });
      } catch (e) {
        this.setState({
          profileImg: null,
        });
      } finally {
        this.setState({
          updatingPhoto: false,
        });
      }
    }
  };

  render() {
    const { user, classes, geojson, handlePhotoClick, handleClose } = this.props;

    const myPhotos = geojson && geojson.features.filter((f) => f.properties.owner_id === user.id);
    const myLastPhotos = _.reverse(_.sortBy(myPhotos, (o) => o.properties.updated)).slice(0, 20);

    console.log(myLastPhotos);

    const numPieces = _.sumBy(myPhotos, (o) => o.properties.pieces);

    console.log(user);

    return (
      <PageWrapper label={config.PAGES.account.label} handleClose={handleClose} header={false}>
        <div className={classes.profileInfo}>
          <div className={classes.wrapper}>
            <IconButton onClick={this.handleAvatarClick} disabled={this.state.updatingPhoto}>
              <Avatar className={classes.avatar} alt="profile-image" src={this.state.profileImg || user.photoURL} />
            </IconButton>

            {this.state.updatingPhoto && <CircularProgress size={AVATAR_SIZE} className={classes.avatarProgress} />}
          </div>

          <RootRef rootRef={this.domRefInput}>
            <input
              className="hidden"
              type="file"
              accept="image/*"
              id={"fileInput"}
              onChange={this.openFile}
              onClick={(e) => (e.target.value = null)}
            />
          </RootRef>

          <ProfileTextField
            fieldName="displayName"
            className={classes.name}
            maxLength={User.DISPLAY_NAME_MAXLENGTH}
            placeholder="My name"
          />

          <Typography gutterBottom variant="h5">
            {user.phoneNumber && ` ph: ${user.phoneNumber}`}
          </Typography>
          <Typography component="p">{user.email}</Typography>
          <Typography>{user.location}</Typography>
          <Typography>{user.description}</Typography>

          <br />

          {myPhotos && (
            <Typography variant="body1">
              Num. of uploads <strong>{myPhotos.length}</strong>
            </Typography>
          )}
          {!isNaN(numPieces) && (
            <Typography variant="body1">
              Total Pieces <strong>{numPieces}</strong>
            </Typography>
          )}

          <br />

          {myLastPhotos.length && (
            <div>
              <Typography variant="h6" className={classes.centered}>
                Last {myLastPhotos.length} uploaded
              </Typography>

              {_.map(myLastPhotos, (photo) => (
                <div className={classes.centered} key={photo.properties.id}>
                  <Typography variant="body1">
                    {photo.properties.pieces && (
                      <span>
                        <strong>{photo.properties.pieces}</strong> pieces{" "}
                      </span>
                    )}
                    <Link to={this.calcUrl(photo)} onClick={() => handlePhotoClick(photo)}>
                      {photo.properties.updated.toDateString()}
                    </Link>

                    <Icon>
                      {photo.properties.published === true && <CheckIcon color="secondary" />}
                      {photo.properties.published === false && <ClearIcon color="error" />}
                      {photo.properties.published !== false && photo.properties.published !== true && (
                        <HourglassEmptyIcon olor="action" />
                      )}
                    </Icon>
                  </Typography>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageWrapper>
    );
  }
}

Profile.propTypes = {
  user: PropTypes.object,
};

export default connect(mapStateToProps)(withStyles(styles)(Profile));
