// Copyright 2015-2017 Parity Technologies (UK) Ltd.
// This file is part of Parity.

// Parity is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Parity is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Parity.  If not, see <http://www.gnu.org/licenses/>.

import React, { Component } from 'react';
import { observer } from 'mobx-react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';

import { createSignedTx, generateTxQr, generateDecryptQr, generateDataQr } from '@parity/shared/lib/util/qrscan';
import Button from '@parity/ui/lib/Button';
import Form from '@parity/ui/lib/Form';
import IdentityIcon from '@parity/ui/lib/IdentityIcon';
import QrCode from '@parity/ui/lib/QrCode';
import QrScan from '@parity/ui/lib/QrScan';
import stores from '@parity/mobx';

import styles from './ConfirmViaQr.css';

const QR_VISIBLE = 1;
const QR_SCAN = 2;
const QR_COMPLETED = 3;

@observer
export default class ConfirmViaQr extends Component {
  static contextTypes = {
    api: PropTypes.object.isRequired
  };

  static propTypes = {
    address: PropTypes.string.isRequired,
    isDisabled: PropTypes.bool,
    request: PropTypes.object.isRequired,
    transaction: PropTypes.object
  };

  netVersionStore = stores.net.version().get(this.context.api);

  state = {
    qrState: QR_VISIBLE,
    qr: {}
  };

  componentWillMount () {
    this.readNonce();
    this.subscribeNonce();
  }

  componentWillUnmount () {
    this.unsubscribeNonce();
  }

  render () {
    const { address, isDisabled } = this.props;
    const confirmText = this.renderConfirmText();
    const confirmButton = confirmText ? (
      <div>
        <Button
          className={ styles.confirmButton }
          isDisabled={ isDisabled }
          fullWidth
          icon={ <IdentityIcon address={ address } button className={ styles.signerIcon } /> }
          label={ confirmText }
          onClick={ this.onConfirm }
        />
      </div>
    ) : null;

    return (
      <div className={ styles.confirmForm }>
        <Form>
          {this.renderQrCode()}
          {this.renderQrScanner()}
          {this.renderHint()}
          {confirmButton}
        </Form>
      </div>
    );
  }

  renderConfirmText () {
    const { qrState } = this.state;

    if (qrState === QR_VISIBLE) {
      return <FormattedMessage id='signer.txPendingConfirm.buttons.scanSigned' defaultMessage='Scan Signed QR' />;
    }

    return null;
  }

  renderHint () {
    const { qrState } = this.state;

    switch (qrState) {
      case QR_VISIBLE:
        return (
          <div className={ styles.passwordHint }>
            <FormattedMessage
              id='signer.sending.external.scanTx'
              defaultMessage='Please scan the transaction QR on your external device'
            />
          </div>
        );

      case QR_SCAN:
        return (
          <div className={ styles.passwordHint }>
            <FormattedMessage
              id='signer.sending.external.scanSigned'
              defaultMessage='Scan the QR code of the signed transaction from your external device'
            />
          </div>
        );

      case QR_COMPLETED:
      default:
        return null;
    }
  }

  renderQrCode () {
    const { qrState, qr } = this.state;

    if (qrState !== QR_VISIBLE || !qr.value) {
      return null;
    }

    return <QrCode className={ styles.qr } value={ qr.value } />;
  }

  renderQrScanner () {
    const { qrState } = this.state;

    if (qrState !== QR_SCAN) {
      return null;
    }

    return <QrScan className={ styles.camera } onScan={ this.onScan } />;
  }

  onScan = signature => {
    const { api } = this.context;
    const { request } = this.props;
    const { qr } = this.state;

    if (!signature) {
      return;
    }

    if (signature && signature.substr(0, 2) !== '0x') {
      signature = `0x${signature}`;
    }

    this.setState({ qrState: QR_COMPLETED });

    if (qr.tx) {
      const { netVersion } = this.netVersionStore;
      const { tx } = qr;
      const { rlp } = createSignedTx(netVersion, signature, tx);

      return api.signer.confirmRequestRaw(request.id, rlp);
    } else {
      // TODO This is not working
      // I get a "Invalid Transaction" error on the phone, for both eth_sign
      // and parity_decryptMessage. -Amaury 27.02.2018
      return api.signer.confirmRequestRaw(request.id, qr.signature);
    }
  };

  onConfirm = () => {
    const { qrState } = this.state;

    if (qrState !== QR_VISIBLE) {
      return;
    }

    this.setState({ qrState: QR_SCAN });
  };

  generateQr = () => {
    const { api } = this.context;
    const { request, transaction } = this.props;
    const { netVersion } = this.netVersionStore;

    const { sign, decrypt } = request.payload;
    const setState = qr => {
      this.setState({ qr });
    };

    if (transaction) {
      if (!netVersion) {
        return;
      } // The subscribeNonce timer will re-run until netVersion is set
      generateTxQr(api, netVersion, transaction).then(setState);
      return;
    }

    if (decrypt) {
      generateDecryptQr(decrypt.msg).then(setState);
      return;
    }

    generateDataQr(sign.data).then(setState);
  };

  subscribeNonce () {
    const nonceTimerId = setInterval(this.readNonce, 1000);

    this.setState({ nonceTimerId });
  }

  unsubscribeNonce () {
    const { nonceTimerId } = this.state;

    if (!nonceTimerId) {
      return;
    }

    clearInterval(nonceTimerId);
  }

  readNonce = () => {
    const { api } = this.context;
    const { address, request, transaction } = this.props;
    const { qr } = this.state;

    if ((request.payload.sign || request.payload.decrypt) && qr && !qr.value) {
      this.generateQr();
      return;
    }

    if (!address || !api.transport.isConnected || !transaction) {
      return;
    }

    return api.parity.nextNonce(address).then(newNonce => {
      const { nonce } = this.state.qr;

      if (!nonce || !newNonce.eq(nonce)) {
        this.generateQr();
      }
    });
  };
}
