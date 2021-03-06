if (chrome.passwordsPrivate) {
  // Remove all saved vault passwords in this app and prevent future saving
  chrome.passwordsPrivate.getSavedPasswordList(passwords => {
    passwords.forEach((p, i) => chrome.passwordsPrivate.removeSavedPassword(i));
  });

  chrome.privacy.services.passwordSavingEnabled.set({
    value: false
  });
}

// Wizard
(function () {
  var onlyKeyConfigWizard;

  function Wizard() {
    this.steps = {};
    this.dialog = new DialogMgr();
    this.currentSlot = {};
  }

  Wizard.prototype.init = function (myOnlyKey) {
    // reset all forms
    document.querySelectorAll('form').forEach(form => form.reset());

    this.onlyKey = myOnlyKey;
    this.initSteps();
    this.currentStep = null;
    this.uiInit();
    this.reset();
  };

  Wizard.prototype.initSteps = function () {
    this.steps = {
      Step1: {
        enterFn: this.setGuided.bind(this, true),
        next: 'Step2',
        noExit: true,
      },
      Step2: {
        prev: 'Step1',
        next: 'Step3',
        disclaimerTrigger: 'passcode1Disclaimer',
        enterFn: (cb) => {
          this.steps.Step3.next = this.guided ? 'Step4' : 'Step1';
          this.onlyKey.flushMessage(this.onlyKey.sendSetPin.bind(this.onlyKey, cb));
        },
        exitFn: this.onlyKey.sendSetPin.bind(this.onlyKey),
      },
      Step3: {
        prev: 'Step2',
        next: 'Step4',
        enterFn: this.onlyKey.sendSetPin.bind(this.onlyKey),
        exitFn: this.onlyKey.sendSetPin.bind(this.onlyKey),
      },
      Step4: {
        prev: 'Step3',
        next: 'Step5',
        disclaimerTrigger: 'passcode3Disclaimer',
        enterFn: () => {
          this.steps.Step5.next = this.guided ? 'Step6' : 'Step1';
          this.onlyKey.flushMessage(this.onlyKey.sendSetPDPin.bind(this.onlyKey));
        },
        exitFn: (cb) => {
          const setSecProfileMode = this.initForm.secProfileMode;
          this.onlyKey.setSecProfileMode(setSecProfileMode.value, this.onlyKey.sendSetPDPin.bind(this.onlyKey, cb));
        },
      },
      Step5: {
        prev: 'Step4',
        next: 'Step6',
        enterFn: this.onlyKey.sendSetPDPin.bind(this.onlyKey),
        exitFn: this.onlyKey.sendSetPDPin.bind(this.onlyKey),
      },
      Step6: {
        prev: 'Step5',
        next: 'Step7',
        disclaimerTrigger: 'passcode2Disclaimer',
        enterFn: () => {
          this.steps.Step7.next = this.guided ? 'Step8' : 'Step1';
          this.onlyKey.flushMessage(this.onlyKey.sendSetSDPin.bind(this.onlyKey));
        },
        exitFn: this.onlyKey.sendSetSDPin.bind(this.onlyKey),
      },
      Step7: {
        prev: 'Step6',
        next: 'Step8',
        enterFn: this.onlyKey.sendSetSDPin.bind(this.onlyKey),
        exitFn: this.onlyKey.sendSetSDPin.bind(this.onlyKey),
      },
      Step8: {
        prev: 'Step7',
        next: 'Step10',
        enterFn: () => {
          this.btnSubmitStep.disabled = false;
          this.steps.Step8.next = this.guided ? 'Step10' : 'Step1';
          this.onlyKey.flushMessage();
        },
        exitFn: (cb) => {
          const backupKeyMode = this.initForm.backupKeyMode;
          this.onlyKey.setbackupKeyMode(backupKeyMode.value, this.submitBackupKey.bind(this, cb));
        }
      },
      Step9: { //Set PGP Key
        prev: 'Step7',
        next: 'Step10',
        enterFn: () => {
          this.btnSubmitStep.disabled = false;
          this.steps.Step9.next = this.guided ? 'Step10' : 'Step1';
          this.onlyKey.flushMessage();
        },
        exitFn: (cb) => {
          const backupKeyMode = this.initForm.backupKeyMode;
          this.onlyKey.setbackupKeyMode(backupKeyMode.value, this.submitBackupRSAKey.bind(this, cb));
        }
      },
      Step10: { //Restore from backup
        prev: 'Step9',
        next: 'Step11',
        enterFn: () => {
          this.btnSubmitStep.disabled = false;
        },
        exitFn: this.submitRestoreFile.bind(this),
      },
      Step11: { //Load Firmware
        prev: 'Step10',
        next: 'Step1',
        enterFn: () => {
          this.btnSubmitStep.disabled = false;
        },
        exitFn: this.submitFirmwareFile.bind(this),
      },
    };
  };

  Wizard.prototype.enableDisclaimer = function (fieldName) {
    if (!fieldName) return;

    const field = this.initForm[fieldName];

    field.removeEventListener('change', this.enableDisclaimer);

    this.btnNext.disabled = !field.checked;
    this.btnSubmitStep.disabled = !field.checked;

    field.addEventListener('change', e => {
      this.enableDisclaimer(fieldName);
    });
  };

  Wizard.prototype.setUnguidedStep = function (newStep) {
    this.setGuided(false);
    this.setNewCurrentStep(newStep);
  };

  Wizard.prototype.gotoStep = function (newStep) {
    this.setGuided(true);
    this.setNewCurrentStep(newStep);
  };

  Wizard.prototype.uiInit = function () {
    this.initForm = document['init-panel'];

    this.initConfigErrors = document.getElementById('initConfigErrors');

    this.setPIN = document.getElementById('SetPIN');
    this.setBackup = document.getElementById('SetBackup');
    this.skipPDPIN = document.getElementById('SkipPDPIN');
    this.setSDPIN = document.getElementById('SetSDPIN');
    this.skipSDPIN = document.getElementById('SkipSDPIN');
    this.setPDPIN = document.getElementById('SetPDPIN');
    this.setPassphrase = document.getElementById('SetPassphrase');
    this.setPGPKey = document.getElementById('SetPGPKey');
    this.restoreBackup = document.getElementById('RestoreBackup');
    this.loadFirmware = document.getElementById('LoadFirmware');

    this.btnNext = document.getElementById('btnNext');
    this.btnPrev = document.getElementById('btnPrevious');
    this.btnExit = document.getElementById('btnExit');

    this.btnSubmitStep = document.getElementById('btnSubmitStep');
    this.btnCancelStep = document.getElementById('btnCancelStep');

    this.setBackup.onclick = this.setUnguidedStep.bind(this, 'Step8');
    this.setSDPIN.onclick = this.setUnguidedStep.bind(this, 'Step6');

    this.skipPDPIN.onclick = (e) => {
      e && e.preventDefault && e.preventDefault();
      this.onlyKey.flushMessage.call(this.onlyKey, this.gotoStep.bind(this, 'Step6'));
    };

    this.skipSDPIN.onclick = (e) => {
      e && e.preventDefault && e.preventDefault();
      this.onlyKey.flushMessage.call(this.onlyKey, this.gotoStep.bind(this, 'Step8'));
    };

    this.setPassphrase.onclick = (e) => {
      e && e.preventDefault && e.preventDefault();
      this.gotoStep('Step8');
    };

    this.setPGPKey.onclick = (e) => {
      e && e.preventDefault && e.preventDefault();
      this.gotoStep('Step9');
    };

    this.loadFirmware.onclick = this.setUnguidedStep.bind(this, 'Step11');


    this.btnNext.onclick = (e) => {
      e && e.preventDefault && e.preventDefault();
      this.setGuided(true);
      this.moveStep('next');
    };

    this.btnPrev.onclick = (e) => {
      e && e.preventDefault && e.preventDefault();
      this.setGuided(true);
      this.onlyKey.flushMessage.call(this.onlyKey, this.moveStep.bind(this, 'prev'));
    };

    this.btnExit.onclick = (e) => {
      e && e.preventDefault && e.preventDefault();
      this.reset();
    };

    this.btnSubmitStep.onclick = (e) => {
      // e && e.preventDefault && e.preventDefault();
      this.moveStep('next');
    };

    this.btnCancelStep.onclick = (e) => {
      e && e.preventDefault && e.preventDefault();
      this.reset();
    };

    this.slotConfigForm = document['slot-config-form'];
    this.slotConfigDialog = document.getElementById('slot-config-dialog');

    this.finalStepDialog = document.getElementById('finalStep-dialog');

    this.slotWipe = document.getElementById('slotWipe');
    this.slotWipe.onclick = e => {
      e && e.preventDefault && e.preventDefault();
      document.getElementById('wipeCurrentSlotId').innerText = this.onlyKey.currentSlotId;
      this.dialog.open(this.slotWipeConfirmDialog, true);
    };

    this.slotWipeConfirmDialog = document.getElementById('slot-wipe-confirm');
    this.slotWipeConfirmBtn = document.getElementById('slotWipeConfirm');
    this.slotWipeConfirmBtn.onclick = e => {
      e && e.preventDefault && e.preventDefault();
      this.onlyKey.wipeSlot(null, null, (err, msg) => {
        // this.onlyKey.listen(function (err, msg) {
        if (!err) {
          this.slotConfigForm.reset();
          this.onlyKey.getLabels();
          this.dialog.closeAll();
        }
        // });
      });
    };

    this.slotWipeCancelBtn = document.getElementById('slotWipeCancel');
    this.slotWipeCancelBtn.onclick = e => {
      e && e.preventDefault && e.preventDefault();
      this.dialog.close(this.slotWipeConfirmDialog);
    };

    this.slotSubmit = document.getElementById('slotSubmit');
    this.slotSubmit.onclick = e => {
      e && e.preventDefault && e.preventDefault();
      this.setSlot();
    };

    // BEGIN PRIVATE KEY SELECTOR
    this.selectPrivateKeyDialog = document.getElementById('select-private-key-dialog');
    this.selectPrivateKeyConfirmBtn = document.getElementById('selectPrivateKeyConfirm');
    this.selectPrivateKeyConfirmBtn.onclick = e => {
      e && e.preventDefault && e.preventDefault();
      const selectedKey = document.querySelector('input[name="rsaKeySelect"]:checked').value;
      this.onlyKey.confirmRsaKeySelect(this.onlyKey.tempRsaKeys[selectedKey], err => {
          if (err) {
            //   return ???
          }

          this.onlyKey.tempRsaKeys = null;
          this.dialog.closeAll();

          if (this.guided) {
            this.setNewCurrentStep(this.steps[this.currentStep]['next'])
          } else {
            this.reset();
          }
      });
    };

    this.selectPrivateKeyCancelBtn = document.getElementById('selectPrivateKeyCancel');
    this.selectPrivateKeyCancelBtn.onclick = e => {
      e && e.preventDefault && e.preventDefault();
      this.onlyKey.tempRsaKeys = null;
      this.dialog.closeAll();
    };
    // END PRIVATE KEY SELECTOR

    this.setActiveStepUI();
  };

  Wizard.prototype.checkInitialized = function () {
    const isInitialized = this.onlyKey && this.onlyKey.isInitialized;

    if (isInitialized) {
      document.querySelectorAll('.init-only').forEach(el => el.classList.remove('hide'));
      document.querySelectorAll('.uninit-only').forEach(el => el.classList.add('hide'));
    } else {
      document.querySelectorAll('.init-only').forEach(el => el.classList.add('hide'));
      document.querySelectorAll('.uninit-only').forEach(el => el.classList.remove('hide'));
    }

    return isInitialized;
  };

  Wizard.prototype.setGuided = function (guided) {
    this.guided = !!guided && !this.checkInitialized(); // guided setup is only for uninitialized devices
  };

  Wizard.prototype.initKeySelect = function (rawKey, cb) {
    const keys = [{
      name: 'Primary Key',
      p: rawKey.primaryKey.mpi[3].data.toByteArray(),
      q: rawKey.primaryKey.mpi[4].data.toByteArray()
    }];

    rawKey.subKeys.forEach((subKey, i) => {
      keys.push({
        name: 'Subkey ' + (i + 1),
        p: subKey.subKey.mpi[3].data.toByteArray(),
        q: subKey.subKey.mpi[4].data.toByteArray()
      });
    });

    this.onlyKey.tempRsaKeys = keys;

    const pkDiv = document.getElementById('private-key-options');
    pkDiv.innerHTML = "";

    keys.forEach((key, i) => {
      pkDiv.appendChild(makeRadioButton('rsaKeySelect', i, key.name));
      pkDiv.appendChild(document.createElement("br"));
    });

    pkDiv.appendChild(document.createElement("br"));

    this.dialog.open(this.selectPrivateKeyDialog, true);
  };


  Wizard.prototype.submitFirmwareFile = function (cb) {
    var firmwareSelect = document.getElementById('firmwareSelectFile');
    this.onlyKey.submitFirmware(firmwareSelect, cb);
  };

  Wizard.prototype.submitRestoreFile = function (cb) {
    var fileSelector = document.getElementById('restoreSelectFile');
    if (!fileSelector.files.length) {
      fileSelector = new File(["-----BEGIN ONLYKEY BACKUP-----\n-----END ONLYKEY BACKUP-----"], "emptybackup.txt");
    }
    this.onlyKey.submitRestore(fileSelector, cb);
  };

  Wizard.prototype.submitBackupKey = function (cb) {

    const key1Input = document.getElementById('backupPassphrase');
    const key2Input = document.getElementById('backupPassphrasec');
    const formErrors = [];

    this.initConfigErrors.innerHTML = "";

    if (!key1Input.value) {
      formErrors.push('Passphrase cannot be empty.');
    }

    if (key1Input.value !== key2Input.value) {
      formErrors.push('Passphrase fields do not match.');
    }

    if (key1Input.value.length < 25) {
      formErrors.push('Passphrase must be at least 25 characters.');
    }

    if (formErrors.length) {
      // early exit
      let html = "<ul>";
      for (let i = 0; i < formErrors.length; i++) {
        html += "<li>" + formErrors[i] + "</li>";
      }
      this.initConfigErrors.innerHTML = html + "</ul>";
      return;
    }

    //formErrors.push(key1.value);
    this.onlyKey.setBackupPassphrase(key1Input.value, cb);
  };

  Wizard.prototype.submitBackupRSAKey = function (cb) {
    const backuprsaKey = document.getElementById('backupRSAKey');
    const backuprsaPasscode = document.getElementById('backupRSAPasscode');
    const backupRSASetAsSignature = document.getElementById('backupRSASetAsSignature')
    if (backupRSASetAsSignature.checked) {
      backupsigFlag = 1;
    } else {
      backupsigFlag = 0;
    }

    this.initConfigErrors.innerHTML = "";

    var key = backuprsaKey.value || '';
    var passcode = backuprsaPasscode.value || '';

    if (!key) {
        this.initConfigErrors.innerHTML = 'RSA Key cannot be empty.';
        return false;
    }

    if (!passcode) {
        this.initConfigErrors.innerHTML = 'Passcode cannot be empty.';
        return false;
    }
    backuprsaKey.value = '';
    backuprsaPasscode.value = '';

    this.onlyKey.setRSABackupKey(key, passcode, cb);
  };

  Wizard.prototype.setSlot = function () {
    this.slotSubmit.disabled = true;
    this.slotWipe.disabled = true;

    const form = this.slotConfigForm;
    const formErrors = [];
    const formErrorsContainer = document.getElementById('slotConfigErrors');
    const fieldMap = {
      chkSlotLabel: {
        input: form.txtSlotLabel,
        msgId: 'LABEL'
      },
      chkSlotUrl: {
        input: form.txtSlotUrl,
        msgId: 'URL'
      },
      tabReturn4: {
        input: form.tabReturn4,
        msgId: 'NEXTKEY4'
      },
      tabReturn1: {
        input: form.tabReturn1,
        msgId: 'NEXTKEY1'
      },
      chkDelay1: {
        input: form.numDelay1,
        msgId: 'DELAY1'
      },
      chkUserName: {
        input: form.txtUserName,
        msgId: 'USERNAME'
      },
      tabReturn2: {
        input: form.tabReturn2,
        msgId: 'NEXTKEY2'
      },
      chkDelay2: {
        input: form.numDelay2,
        msgId: 'DELAY2'
      },
      chkPassword: {
        input: form.txtPassword,
        msgId: 'PASSWORD'
      },
      tabReturn5: {
        input: form.tabReturn5,
        msgId: 'NEXTKEY5'
      },
      tabReturn3: {
        input: form.tabReturn3,
        msgId: 'NEXTKEY3'
      },
      chkDelay3: {
        input: form.numDelay3,
        msgId: 'DELAY3'
      },
      mode: {
        input: form.mode,
        msgId: 'TFATYPE'
      },
      txt2FAUserName: {
        input: form.txt2FAUserName,
        msgId: 'TFAUSERNAME'
      }
    };

    formErrorsContainer.innerHTML = "";

    if (form.txtPassword.value !== form.txtPasswordConfirm.value) {
      formErrors.push('Password fields do not match');
    }

    if (formErrors.length) {
      // early exit
      let html = "<ul>";
      for (let i = 0; i < formErrors.length; i++) {
        html += "<li><blink>" + formErrors[i]; + "</blink></li>";
      }
      formErrorsContainer.innerHTML = html + "</ul>";

      this.slotSubmit.disabled = false;
      this.slotWipe.disabled = false;
      return;
    }

    // process all form fields
    for (let field in fieldMap) {
      let isChecked = false;
      let formValue = null;

      switch (form[field].type) {
        case 'checkbox':
          if (form[field].checked) {
            isChecked = true;
            formValue = ('' + (fieldMap[field].input).value).trim();
            form[field].checked = false;
          }
          break;
        case 'hidden':
        case 'number':
        case 'text':
          const checkVar = ('' + (form[field].value)).trim();
          if (checkVar.length) {
            isChecked = true;
            formValue = ('' + (fieldMap[field].input).value).trim();
            form[field].value = '';
          }
          break;
        case undefined: // radios?
          if (form[field].value !== '') {
            isChecked = true;
            formValue = (fieldMap[field].input).value;
            clearRadios(field);
          }
          break;
        default:
          break;
      }

      if (isChecked) {
        this.currentSlot[field] = formValue;

        switch (field) {
          case 'txt2FAUserName':
            if (this.currentSlot.mode === 'googleAuthOtp') {
              console.info("BASE32 value:", formValue);
              formValue = base32tohex(formValue.replace(/\s/g, ''));
              formValue = formValue.match(/.{2}/g);
              console.info("was converted to HEX:", formValue);
            }
            break;
        }

        this.onlyKey.setSlot(null, fieldMap[field].msgId, formValue, (err, msg) => {
          if (!err) {
            this.setSlot();
          }
        });

        return;
      }
    }

    form.reset();
    this.currentSlot = {};
    this.slotSubmit.disabled = false;
    this.slotWipe.disabled = false;
    this.onlyKey.getLabels();
    this.dialog.close(this.slotConfigDialog);
  }

  Wizard.prototype.getMode = function () {
    return this.initForm['ConfigMode'].value;
  };

  Wizard.prototype.moveStep = function (direction) {
    // if a next/prev step exists, call current step-related exit function
    // and set new current step
    this.currentStep = this.currentStep || 'Step1';

    if (this.steps[this.currentStep][direction]) {
      if (this.steps[this.currentStep].exitFn) {
        console.info(`Calling ${this.currentStep} exitFn.`);
        this.steps[this.currentStep].exitFn((err, res) => {
          if (err) {
            console.error(err);
            this.goBackOnError(err, res);
          } else if (res !== 'STOP') {
            console.info(`exitFn callback res === ${res}`);
            this.setNewCurrentStep(this.steps[this.currentStep][direction]);
          }

          console.warn(`exitFn callback called with no return.`)
        });
      } else {
        this.setNewCurrentStep(this.steps[this.currentStep][direction]);
      }
    }
  };

  Wizard.prototype.goBackOnError = function (err, lastMessageSent) {
    console.warn(`goBackOnError handling ${lastMessageSent} error: ${err}`);
    if (err) {
      switch (lastMessageSent) {
        case 'OKSETPIN':
          this.setNewCurrentStep('Step2');
          break;
        case 'OKSETPDPIN':
          this.setNewCurrentStep('Step4');
          break;
        case 'OKSETSDPIN':
          this.setNewCurrentStep('Step6');
          break;
      }
    }
  };

  Wizard.prototype.setNewCurrentStep = function (stepId) {
    this.currentStep = stepId;

    if (this.currentStep) {

      // call new current step-related enter function
      if (this.steps[stepId].enterFn) {
        console.info(`Calling ${stepId} enterFn.`);
        this.steps[stepId].enterFn((err, res) => {
          if (err) {
            console.error(err);
            this.goBackOnError(err, res);
          } else {
            console.info(res);
          }
        });
      }
    }

    this.setActiveStepUI();
  };

  Wizard.prototype.setActiveStepUI = function () {
    // set display style for all steps
    const currentStepOrFirst = this.currentStep || 'Step1';

    for (var stepId in this.steps) {
      var el = document.getElementById(stepId);
      if (el) {
        if (stepId === currentStepOrFirst) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      }
    }

    const disclaimerTrigger = this.steps[currentStepOrFirst].disclaimerTrigger;

    if (this.guided) {
      document.getElementById('guided').classList.remove('hide');
      document.getElementById('unguided').classList.add('hide');

      if (this.steps[currentStepOrFirst].next) {
        if (!disclaimerTrigger) {
          this.btnNext.removeAttribute('disabled');
        } else {
          this.enableDisclaimer(disclaimerTrigger);
        }
      } else {
        this.btnNext.setAttribute('disabled', 'disabled');
      }

      if (this.steps[currentStepOrFirst].prev) {
        this.btnPrev.removeAttribute('disabled');
      } else {
        this.btnPrev.setAttribute('disabled', 'disabled');
      }

      if (this.steps[currentStepOrFirst].noExit) {
        this.btnExit.classList.add('hide');
      } else {
        this.btnExit.classList.remove('hide');
      }
    } else {
      document.getElementById('guided').classList.add('hide');

      if (this.currentStep) {
        this.enableDisclaimer(disclaimerTrigger);
        document.getElementById('unguided').classList.remove('hide');
      } else {
        document.getElementById('unguided').classList.add('hide');
      }
    }

    this.initConfigErrors.innerHTML = '';

    return false;
  };

  Wizard.prototype.setLastMessages = function (messages) {
    var container = document.getElementById('lastMessage');
    var messageListItems = container.getElementsByTagName('li');

    container.getElementsByTagName('span')[0].innerText = messages[0].text;
    if (messages[1]) messageListItems[0].innerText = messages[1].text;
    if (messages[2]) messageListItems[1].innerText = messages[2].text;
  };

  Wizard.prototype.setSlotLabel = function (slot, label) {
    var slotLabel;
    if (typeof slot === 'number') {
      slot = slot;
      var slotLabels = Array.from(document.getElementsByClassName('slotLabel'));
      slotLabel = slotLabels[slot];
    } else {
      slot = slot.toLowerCase();
      slotLabel = document.getElementById('slotLabel' + slot);
    }
    slotLabel.innerText = label;
    if (label === 'empty') {
      slotLabel.classList.add('empty');
    } else {
      slotLabel.classList.remove('empty');
    }
  };

  Wizard.prototype.reset = function () {
    this.setGuided(true);
    this.onlyKey.flushMessage.call(this.onlyKey, this.setNewCurrentStep.bind(this, null));
  };

  document.addEventListener('DOMContentLoaded', () => {
    console.info("Creating wizard instance...");
    onlyKeyConfigWizard = new Wizard();
    OnlyKeyHID(onlyKeyConfigWizard);
  }, false);
})();


class DialogMgr {
  open(el, keepOthersOpen) {
    if (!keepOthersOpen) {
      this.closeAll();
    }
    if (!el.open) {
      el.showModal();
    }
  }

  close(el) {
    if (el.open) {
      el.close();
    }
  }

  closeAll() {
    const allDialogs = document.getElementsByTagName('dialog');
    for (let i = 0; i < allDialogs.length; i++) {
      this.close(allDialogs[i]);
    }
  }
}

function clearRadios(name) {
  var btns = document.getElementsByName(name);
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].checked) btns[i].checked = false;
  }
}

function makeRadioButton(name, value, text) {
  var label = document.createElement("label");
  var radio = document.createElement("input");
  radio.type = "radio";
  radio.name = name;
  radio.value = value;

  label.appendChild(radio);
  label.appendChild(document.createTextNode(text));
  return label;
}

// we owe russ a beer
// http://blog.tinisles.com/2011/10/google-authenticator-one-time-password-algorithm-in-javascript/
function base32tohex(base32) {
  var base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  var bits = "";
  var hex = "";

  for (var i = 0; i < base32.length; i++) {
    var val = base32chars.indexOf(base32.charAt(i).toUpperCase());
    bits += strPad(val.toString(2), 5, '0');
  }

  for (var i = 0; i + 4 <= bits.length; i += 4) {
    var chunk = bits.substr(i, 4);
    hex = hex + parseInt(chunk, 2).toString(16);
  }

  return hex;
}
